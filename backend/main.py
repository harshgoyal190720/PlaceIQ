import os
import json
import asyncio
from datetime import datetime, timedelta
from typing import List

import jwt
from fastapi import FastAPI, HTTPException, Depends, status, Body, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from bson import ObjectId
import motor.motor_asyncio
import google.generativeai as genai
from pdfminer.high_level import extract_text
from tempfile import NamedTemporaryFile
from dotenv import load_dotenv

from auth import verify_password
from models import UserLogin
import ml_engine
from seed import seed_db

JWT_SECRET = os.environ.get("JWT_SECRET", "placeiq-jwt-secret-2024")
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "placeiq")
load_dotenv()

GEMINI_KEY = os.environ.get("GEMINI_API_KEY")

app = FastAPI(title="PlaceIQ API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]
bearer_scheme = HTTPBearer()


# ---------------------- Helpers ----------------------

def serialize_doc(doc):
    if not doc:
        return doc
    doc = dict(doc)
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            doc[k] = str(v)
    return doc


def create_token(user_id: str, role: str):
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.exceptions.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user["_id"] = str(user["_id"])
    return user


async def get_admin_user(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------------------- Auth ----------------------

@app.post("/auth/login")
async def login(payload: UserLogin = Body(...)):
    user = await db.users.find_one({"email": payload.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(payload.password, user.get("password", b"")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(str(user["_id"]), user.get("role"))
    resp = {
        "token": token,
        "role": user.get("role"),
        "name": user.get("name"),
        "student_id": str(user.get("student_id")) if user.get("student_id") else None
    }
    return resp


# ---------------------- Student Routes ----------------------

@app.get("/students/me")
async def get_me(user=Depends(get_current_user)):
    student = None
    if user.get("role") == "student" and user.get("student_id"):
        student = await db.students.find_one({"_id": ObjectId(user.get("student_id"))})
    if not student:
        student = await db.students.find_one({"email": user.get("email")})
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return serialize_doc(student)


@app.get("/students/recommendations/{student_id}")
async def student_recommendations(student_id: str, user=Depends(get_current_user)):
    student = await db.students.find_one({"_id": ObjectId(student_id)})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    companies_cursor = db.companies.find({})
    companies = [serialize_doc(c) async for c in companies_cursor]
    recs = ml_engine.compute_recommendations(serialize_doc(student), companies)
    return recs


@app.get("/students/ai-advice/{student_id}")
async def ai_advice(student_id: str, user=Depends(get_current_user)):
    student = await db.students.find_one({"_id": ObjectId(student_id)})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    apps_cursor = db.applications.aggregate([
        {"$match": {"student_id": ObjectId(student_id)}},
        {"$lookup": {
            "from": "companies",
            "localField": "company_id",
            "foreignField": "_id",
            "as": "company"
        }},
        {"$unwind": "$company"}
    ])
    applications = [serialize_doc(a) async for a in apps_cursor]

    companies = [serialize_doc(c) async for c in db.companies.find({})]
    recs = ml_engine.compute_recommendations(serialize_doc(student), companies)[:3]
    top_company = recs[0]["name"] if recs else ""
    top_match = recs[0]["selection_probability"] if recs else 0

    prompt = f"""
Analyze this student's placement readiness and give exactly 3 next steps.

Student Profile:
- Name: {student.get('name')}, Branch: {student.get('branch')}, CGPA: {student.get('cgpa')}
- Skills: {', '.join(student.get('skills', []))}
- Projects: {student.get('projects')}, Internships: {student.get('internships')}, Backlogs: {student.get('backlogs')}
- Applications sent: {len(applications)}, Offers: {student.get('offers', 0)}
- Top matched company: {top_company} ({top_match}% match)

Respond ONLY with this JSON structure, no markdown, no extra text:
{{
  'steps': [
    {{ 'icon': '🎯', 'action': '...', 'reason': '...', 'priority': 'high|medium|low', 'deadline': '...' }},
    {{ 'icon': '📚', 'action': '...', 'reason': '...', 'priority': 'high|medium|low', 'deadline': '...' }},
    {{ 'icon': '🚀', 'action': '...', 'reason': '...', 'priority': 'high|medium|low', 'deadline': '...' }}
  ],
  'readiness_score': <number 0-100>,
  'summary': '<one sentence placement outlook>'
}}"""

    fallback = {
        "steps": [
            {"icon": "🎯", "action": "Solve 3 DSA problems daily", "reason": "Improve problem-solving for product company rounds", "priority": "high", "deadline": "14 days"},
            {"icon": "📚", "action": "Build a mini-project with React + Node", "reason": "Showcase full-stack ability", "priority": "medium", "deadline": "30 days"},
            {"icon": "🚀", "action": "Apply to 2 new companies each week", "reason": "Increase interview opportunities", "priority": "medium", "deadline": "weekly"}
        ],
        "readiness_score": 62,
        "summary": "Good momentum, focus on depth and consistent applications."
    }

    if not GEMINI_KEY:
        return fallback

    try:
        genai.configure(api_key=GEMINI_KEY)
        model = genai.GenerativeModel("gemini-1.5-pro-latest")
        resp = await model.generate_content_async(prompt)
        content_text = resp.text if hasattr(resp, "text") else str(resp)
        parsed = json.loads(content_text.replace("'", '"'))
        return parsed
    except Exception:
        return fallback


@app.post("/students/resume/{student_id}")
async def upload_resume(student_id: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    if user.get("role") != "admin" and str(user.get("student_id")) != student_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    try:
        content = await file.read()
        suffix = f"_{file.filename or 'resume.pdf'}"
        tmp = NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.write(content)
        tmp.flush()
        tmp.close()
        text = extract_text(tmp.name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract text: {e}")
    finally:
        import os
        if 'tmp' in locals():
            try:
                os.remove(tmp.name)
            except OSError:
                pass
    await db.students.update_one({"_id": ObjectId(student_id)}, {"$set": {"resume_text": text, "resume_filename": file.filename, "resume_updated": datetime.utcnow()}})
    return {"message": "Resume processed", "chars": len(text)}


def extract_skills_from_text(text: str, companies: list):
    vocabulary = set()
    for c in companies:
        vocabulary.update([s.lower() for s in c.get("required_skills", [])])
    found = set()
    lower = text.lower()
    for skill in vocabulary:
        if skill in lower:
            found.add(skill)
    return list(found)


@app.get("/students/resume-prediction/{student_id}")
async def resume_prediction(student_id: str, user=Depends(get_current_user)):
    student = await db.students.find_one({"_id": ObjectId(student_id)})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if not student.get("resume_text"):
        raise HTTPException(status_code=400, detail="Resume not uploaded")

    companies = [serialize_doc(c) async for c in db.companies.find({})]
    resume_skills = extract_skills_from_text(student.get("resume_text", ""), companies)
    enriched_student = dict(student)
    enriched_student["skills"] = list(set(student.get("skills", [])) | set(resume_skills))

    predictions = []
    for comp in companies:
        prob = ml_engine.compute_selection_probability(enriched_student, comp)
        predictions.append({
            "company": comp.get("name"),
            "selection_probability": prob,
            "matched_from_resume": list(set(resume_skills) & set([s.lower() for s in comp.get("required_skills", [])])),
            "missing_skills": list(set(comp.get("required_skills", [])) - set(enriched_student["skills"]))
        })
    predictions = sorted(predictions, key=lambda x: x["selection_probability"], reverse=True)[:10]
    return {"resume_skills": resume_skills, "predictions": predictions}


@app.get("/applications/student/{student_id}")
async def student_applications(student_id: str, user=Depends(get_current_user)):
    cursor = db.applications.aggregate([
        {"$match": {"student_id": ObjectId(student_id)}},
        {"$lookup": {
            "from": "companies",
            "localField": "company_id",
            "foreignField": "_id",
            "as": "company"
        }},
        {"$unwind": "$company"}
    ])
    apps = []
    async for doc in cursor:
        doc = serialize_doc(doc)
        doc["company_name"] = doc.get("company", {}).get("name")
        doc["package"] = doc.get("company", {}).get("package")
        doc.pop("company", None)
        apps.append(doc)
    return apps


# ---------------------- Admin Routes ----------------------

@app.get("/students/all")
async def all_students(admin=Depends(get_admin_user)):
    students = [serialize_doc(s) async for s in db.students.find({})]
    return students


@app.get("/analytics/overview")
async def analytics_overview(admin=Depends(get_admin_user)):
    total_students = await db.students.count_documents({})
    total_companies = await db.companies.count_documents({})
    total_applications = await db.applications.count_documents({})
    total_offers = await db.applications.count_documents({"status": "offer"})

    cgpa_cursor = db.students.aggregate([
        {"$group": {"_id": None, "avg_cgpa": {"$avg": "$cgpa"}}}
    ])
    avg_cgpa_doc = await cgpa_cursor.to_list(1)
    avg_cgpa = round(avg_cgpa_doc[0].get("avg_cgpa", 0), 2) if avg_cgpa_doc else 0

    package_cursor = db.companies.aggregate([
        {"$group": {"_id": None, "avg_package": {"$avg": "$package"}}}
    ])
    pkg_doc = await package_cursor.to_list(1)
    avg_package = round(pkg_doc[0].get("avg_package", 0), 2) if pkg_doc else 0

    placement_rate = round((total_offers / total_students) * 100, 1) if total_students else 0

    branch_stats_cursor = db.students.aggregate([
        {"$group": {"_id": "$branch", "count": {"$sum": 1}, "avg_cgpa": {"$avg": "$cgpa"}}}
    ])
    branch_stats = [
        {"branch": doc.get("_id"), "count": doc.get("count"), "avg_cgpa": round(doc.get("avg_cgpa", 0), 2)}
        async for doc in branch_stats_cursor
    ]

    skill_demand_cursor = db.companies.aggregate([
        {"$unwind": "$required_skills"},
        {"$group": {"_id": "$required_skills", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ])
    skill_demand = [
        {"skill": doc.get("_id"), "count": doc.get("count")}
        async for doc in skill_demand_cursor
    ]

    sector_cursor = db.companies.aggregate([
        {"$group": {"_id": "$sector", "count": {"$sum": 1}}}
    ])
    sector_distribution = [
        {"sector": doc.get("_id"), "count": doc.get("count")}
        async for doc in sector_cursor
    ]

    activity_cursor = db.applications.aggregate([
        {"$sort": {"applied_on": -1}},
        {"$limit": 10},
        {"$lookup": {"from": "students", "localField": "student_id", "foreignField": "_id", "as": "student"}},
        {"$lookup": {"from": "companies", "localField": "company_id", "foreignField": "_id", "as": "company"}},
        {"$unwind": "$student"},
        {"$unwind": "$company"}
    ])
    recent_activity = []
    async for doc in activity_cursor:
        recent_activity.append({
            "id": str(doc.get("_id")),
            "status": doc.get("status"),
            "applied_on": doc.get("applied_on"),
            "student_name": doc.get("student", {}).get("name"),
            "company_name": doc.get("company", {}).get("name"),
            "package": doc.get("company", {}).get("package"),
        })

    return {
        "total_students": total_students,
        "total_companies": total_companies,
        "total_applications": total_applications,
        "total_offers": total_offers,
        "placement_rate": placement_rate,
        "avg_cgpa": avg_cgpa,
        "avg_package": avg_package,
        "branch_stats": branch_stats,
        "skill_demand": skill_demand,
        "sector_distribution": sector_distribution,
        "recent_activity": recent_activity
    }


@app.get("/companies")
async def get_companies(user=Depends(get_current_user)):
    comps = [serialize_doc(c) async for c in db.companies.find({})]
    return comps


@app.post("/companies")
async def create_company(company: dict = Body(...), admin=Depends(get_admin_user)):
    required_fields = ["name", "package", "required_cgpa", "required_skills", "sector", "rounds"]
    if not all(field in company for field in required_fields):
        raise HTTPException(status_code=400, detail="Missing company fields")
    res = await db.companies.insert_one(company)
    company["_id"] = str(res.inserted_id)
    return company


@app.patch("/applications/{app_id}/status")
async def update_application_status(app_id: str, payload: dict = Body(...), admin=Depends(get_admin_user)):
    new_status = payload.get("status")
    if new_status not in ["applied", "shortlisted", "interview", "offer", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.applications.update_one({"_id": ObjectId(app_id)}, {"$set": {"status": new_status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")
    updated = await db.applications.find_one({"_id": ObjectId(app_id)})
    return serialize_doc(updated)


# ---------------------- Startup ----------------------

@app.on_event("startup")
async def startup_event():
    await seed_db(db)


# ---------------------- Health ----------------------

@app.get("/")
async def root():
    return {"status": "ok", "service": "PlaceIQ"}
