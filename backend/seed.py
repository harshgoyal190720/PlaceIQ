import asyncio
from datetime import datetime
from bson import ObjectId
from auth import hash_password

admin_user = {
    "email": "admin@placeiq.edu",
    "password": "admin123",
    "role": "admin",
    "name": "Dr. Priya Sharma"
}

students_seed = [
    {
        "name": "Aarav Mehta",
        "email": "student1@placeiq.edu",
        "branch": "CSE",
        "cgpa": 8.9,
        "skills": ["Python", "DSA", "ML", "SQL", "Cloud"],
        "projects": 4,
        "internships": 2,
        "backlogs": 0,
        "year": 4,
        "applications_count": 0,
        "offers": 0,
        "status": "active"
    },
    {
        "name": "Diya Nair",
        "email": "student2@placeiq.edu",
        "branch": "ECE",
        "cgpa": 8.2,
        "skills": ["C++", "DSA", "OS", "Networking", "Python"],
        "projects": 3,
        "internships": 1,
        "backlogs": 0,
        "year": 4,
        "applications_count": 0,
        "offers": 0,
        "status": "active"
    },
    {
        "name": "Kabir Singh",
        "email": "student3@placeiq.edu",
        "branch": "ME",
        "cgpa": 7.1,
        "skills": ["Java", "DSA", "SQL", "Communication", "Testing"],
        "projects": 2,
        "internships": 1,
        "backlogs": 0,
        "year": 4,
        "applications_count": 0,
        "offers": 0,
        "status": "active"
    },
    {
        "name": "Riya Patel",
        "email": "student4@placeiq.edu",
        "branch": "Civil",
        "cgpa": 6.8,
        "skills": ["Python", "SQL", "Excel", "Communication"],
        "projects": 2,
        "internships": 0,
        "backlogs": 1,
        "year": 4,
        "applications_count": 0,
        "offers": 0,
        "status": "active"
    },
    {
        "name": "Arjun Rao",
        "email": "student5@placeiq.edu",
        "branch": "CSE",
        "cgpa": 9.2,
        "skills": ["Python", "Java", "DSA", "System Design", "Cloud", "Docker"],
        "projects": 5,
        "internships": 2,
        "backlogs": 0,
        "year": 4,
        "applications_count": 0,
        "offers": 0,
        "status": "active"
    },
    {
        "name": "Meera Iyer",
        "email": "student6@placeiq.edu",
        "branch": "ECE",
        "cgpa": 7.6,
        "skills": ["C++", "DSA", "React", "Node.js", "ML"],
        "projects": 3,
        "internships": 1,
        "backlogs": 0,
        "year": 4,
        "applications_count": 0,
        "offers": 0,
        "status": "active"
    },
    {
        "name": "Soham Kulkarni",
        "email": "student7@placeiq.edu",
        "branch": "CSE",
        "cgpa": 6.5,
        "skills": ["Java", "SQL", "Communication", "React"],
        "projects": 1,
        "internships": 0,
        "backlogs": 0,
        "year": 4,
        "applications_count": 0,
        "offers": 0,
        "status": "active"
    },
    {
        "name": "Tanvi Sharma",
        "email": "student8@placeiq.edu",
        "branch": "CSE",
        "cgpa": 9.0,
        "skills": ["Python", "ML", "Data Engineering", "Cloud", "DSA"],
        "projects": 4,
        "internships": 3,
        "backlogs": 0,
        "year": 4,
        "applications_count": 0,
        "offers": 0,
        "status": "active"
    }
]

companies_seed = [
    {"name": "Google", "package": 45.0, "required_cgpa": 7.5, "required_skills": ["Python", "DSA", "System Design", "ML", "LLD"], "sector": "Product", "rounds": 5},
    {"name": "Microsoft", "package": 42.0, "required_cgpa": 7.0, "required_skills": ["C++", "DSA", "OS", "Networking", "LLD"], "sector": "Product", "rounds": 4},
    {"name": "Amazon", "package": 38.0, "required_cgpa": 7.0, "required_skills": ["Python", "DSA", "Cloud", "Java", "SQL"], "sector": "Product", "rounds": 4},
    {"name": "Goldman Sachs", "package": 32.0, "required_cgpa": 7.5, "required_skills": ["Python", "DSA", "Finance", "SQL", "Statistics"], "sector": "Finance", "rounds": 4},
    {"name": "Adobe", "package": 28.0, "required_cgpa": 7.0, "required_skills": ["DSA", "React", "Node.js", "System Design"], "sector": "Product", "rounds": 3},
    {"name": "Wipro", "package": 7.5, "required_cgpa": 6.0, "required_skills": ["Java", "SQL", "Communication", "Testing"], "sector": "Service", "rounds": 2},
    {"name": "Infosys", "package": 6.5, "required_cgpa": 6.0, "required_skills": ["Java", "SQL", "Communication"], "sector": "Service", "rounds": 2},
    {"name": "TCS", "package": 7.0, "required_cgpa": 6.0, "required_skills": ["Python", "Java", "SQL", "Communication"], "sector": "Service", "rounds": 2},
    {"name": "Deloitte", "package": 12.0, "required_cgpa": 6.5, "required_skills": ["SQL", "Excel", "Communication", "Python"], "sector": "Consulting", "rounds": 3},
    {"name": "Flipkart", "package": 35.0, "required_cgpa": 7.0, "required_skills": ["DSA", "Python", "Java", "System Design", "Cloud"], "sector": "Product", "rounds": 4}
]

applications_seed = [
    (0, 0, "applied"),
    (0, 2, "shortlisted"),
    (1, 1, "interview"),
    (1, 3, "applied"),
    (2, 5, "offer"),
    (3, 6, "rejected"),
    (4, 0, "shortlisted"),
    (4, 9, "applied"),
    (5, 4, "applied"),
    (6, 7, "applied"),
    (7, 0, "interview"),
    (7, 2, "applied"),
]


async def seed_db(db):
    users_count = await db.users.count_documents({})
    if users_count > 0:
        return

    # Insert students
    student_ids = []
    for student in students_seed:
        res = await db.students.insert_one(student)
        student_ids.append(res.inserted_id)

    # Insert admin
    admin_doc = {
        "email": admin_user["email"],
        "password": hash_password(admin_user["password"]),
        "role": "admin",
        "name": admin_user["name"],
    }
    await db.users.insert_one(admin_doc)

    # Insert student users mapping to profiles
    for idx, student_id in enumerate(student_ids):
        student = students_seed[idx]
        await db.users.insert_one({
            "email": student["email"],
            "password": hash_password("student123"),
            "role": "student",
            "name": student["name"],
            "student_id": student_id
        })

    # Insert companies
    company_ids = []
    for company in companies_seed:
        res = await db.companies.insert_one(company)
        company_ids.append(res.inserted_id)

    # Insert applications
    for student_index, company_index, status in applications_seed:
        await db.applications.insert_one({
            "student_id": student_ids[student_index],
            "company_id": company_ids[company_index],
            "status": status,
            "applied_on": datetime.utcnow().isoformat()
        })

    # Update applications_count per student
    for sid in student_ids:
        count = await db.applications.count_documents({"student_id": sid})
        offers = await db.applications.count_documents({"student_id": sid, "status": "offer"})
        await db.students.update_one({"_id": sid}, {"$set": {"applications_count": count, "offers": offers}})


if __name__ == "__main__":
    # Manual trigger for debugging
    import motor.motor_asyncio
    import os

    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
    client = motor.motor_asyncio.AsyncIOMotorClient(mongo_uri)
    db = client["placeiq"]
    asyncio.run(seed_db(db))
