from typing import List, Dict
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity


def compute_skill_match_score(student_skills: List[str], company_skills: List[str]) -> float:
    vocab = list(set([s.lower() for s in student_skills + company_skills]))
    if not vocab:
        return 0.0
    student_vec = np.array([1 if skill in [s.lower() for s in student_skills] else 0 for skill in vocab]).reshape(1, -1)
    company_vec = np.array([1 if skill in [s.lower() for s in company_skills] else 0 for skill in vocab]).reshape(1, -1)
    sim = cosine_similarity(student_vec, company_vec)[0][0]
    return float(round(sim, 4))


def compute_selection_probability(student: Dict, company: Dict) -> float:
    skill_match = compute_skill_match_score(student.get("skills", []), company.get("required_skills", []))
    cgpa_ratio = min(student.get("cgpa", 0) / max(company.get("required_cgpa", 1), 1), 1.2)
    projects_score = min(student.get("projects", 0) / 3, 1.0)
    internship_score = min(student.get("internships", 0) / 2, 1.0)
    backlog_penalty = 1.0 if student.get("backlogs", 0) == 0 else 0.6

    prob = (
        0.35 * skill_match +
        0.25 * cgpa_ratio +
        0.15 * projects_score +
        0.15 * internship_score +
        0.10 * backlog_penalty
    )
    return round(float(prob * 100), 1)


def compute_recommendations(student: Dict, companies: List[Dict]) -> List[Dict]:
    results = []
    for company in companies:
        if student.get("cgpa", 0) < company.get("required_cgpa", 0) - 0.5:
            continue
        prob = compute_selection_probability(student, company)
        missing = list(set(company.get("required_skills", [])) - set(student.get("skills", [])))[:4]
        match_label = "Excellent" if prob > 75 else "Good" if prob > 50 else "Fair"
        results.append({
            **company,
            "skill_match_score": compute_skill_match_score(student.get("skills", []), company.get("required_skills", [])),
            "selection_probability": prob,
            "missing_skills": missing,
            "match_label": match_label
        })
    results = sorted(results, key=lambda x: x.get("selection_probability", 0), reverse=True)
    return results[:8]


def get_skill_gap_analysis(student: Dict, target_companies: List[Dict]) -> Dict:
    from collections import Counter
    all_skills = []
    for comp in target_companies:
        all_skills.extend(comp.get("required_skills", []))
    counts = Counter([s.lower() for s in all_skills])
    total = sum(counts.values()) or 1
    student_skills = {s.lower() for s in student.get("skills", [])}

    critical, recommended, optional = [], [], []
    for skill, freq in counts.items():
        if skill in student_skills:
            continue
        pct = (freq / total) * 100
        if pct > 60:
            critical.append(skill)
        elif pct >= 30:
            recommended.append(skill)
        else:
            optional.append(skill)
    return {
        "critical": critical,
        "recommended": recommended,
        "optional": optional
    }
