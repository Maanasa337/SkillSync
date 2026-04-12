"""
SkillSync Seed Script
Creates demo data: company, admin, employees, courses, progress, incentives
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from config import MONGO_URI, DATABASE_NAME
from datetime import datetime, timedelta
import random

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DATABASE_NAME]

    # Clear existing data
    for col in ["users", "companies", "courses", "progress", "incentives"]:
        await db[col].drop()

    print("🗑️  Cleared existing data")

    # ---- Company ----
    company = await db.companies.insert_one({
        "name": "PrecisionTech Manufacturing",
        "total_employees": 8,
    })
    company_id = str(company.inserted_id)
    print(f"🏭 Company created: PrecisionTech Manufacturing")

    # ---- Admin ----
    admin = await db.users.insert_one({
        "name": "Priya Sharma",
        "email": "admin@skillsync.com",
        "password": pwd_context.hash("admin123"),
        "role": "admin",
        "company_id": company_id,
        "job_role": "HR Manager",
    })
    print(f"👩‍💼 Admin created: admin@skillsync.com / admin123")

    # ---- Employees ----
    employees_data = [
        {"name": "Rahul Kumar", "email": "rahul@skillsync.com", "job_role": "CNC Operator", "months_ago": 7},
        {"name": "Anjali Patel", "email": "anjali@skillsync.com", "job_role": "Quality Inspector", "months_ago": 8},
        {"name": "Vikram Singh", "email": "vikram@skillsync.com", "job_role": "Safety Officer", "months_ago": 5},
        {"name": "Meera Reddy", "email": "meera@skillsync.com", "job_role": "Assembly Technician", "months_ago": 6},
        {"name": "Arjun Nair", "email": "arjun@skillsync.com", "job_role": "Machine Operator", "months_ago": 9},
        {"name": "Kavitha Iyer", "email": "kavitha@skillsync.com", "job_role": "Process Engineer", "months_ago": 7},
        {"name": "Suresh Babu", "email": "suresh@skillsync.com", "job_role": "Maintenance Tech", "months_ago": 3},
        {"name": "Deepa Menon", "email": "deepa@skillsync.com", "job_role": "Shift Supervisor", "months_ago": 2},
    ]

    emp_ids = []
    for emp_data in employees_data:
        months_ago = emp_data.pop("months_ago")
        start_date = (datetime.utcnow() - timedelta(days=months_ago * 30)).isoformat()
        
        result = await db.users.insert_one({
            **emp_data,
            "password": pwd_context.hash("emp123"),
            "role": "employee",
            "company_id": company_id,
            "training_start_date": start_date
        })
        emp_ids.append(str(result.inserted_id))
    print(f"👷 {len(emp_ids)} employees created (password: emp123)")

    # ---- Courses ----
    courses_data = [
        {
            "title": "Industrial Safety Fundamentals", 
            "category": "Safety", "type": "mandatory", "linked_scheme": "NAPS", "incentive_value": 5000,
            "description": "Comprehensive guide to industrial safety protocols, hazard identification, and emergency response.",
            "skills": ["Hazard Identification", "PPE Usage", "Emergency Response"],
            "youtube_url": "https://www.youtube.com/embed/jB2kS-S-cOE",
            "duration_minutes": 45,
            "duration_days": 15
        },
        {
            "title": "Fire Safety & Extinguisher Use", 
            "category": "Safety", "type": "mandatory", "linked_scheme": "NAPS", "incentive_value": 3000,
            "description": "Learn the classes of fire, preventative measures, and how to operate various fire extinguishers safely.",
            "skills": ["Fire Classification", "Extinguisher Operation", "Evacuation Planning"],
            "youtube_url": "https://www.youtube.com/embed/2_88YQ9sI5o",
            "duration_minutes": 60,
            "duration_days": 10
        },
        {
            "title": "CNC Machine Operations & Setup", 
            "category": "Operations", "type": "role-based", "linked_scheme": "NEEM", "incentive_value": 8000,
            "description": "Foundational training on CNC machine operations, tool setup, and basic G-code programming.",
            "skills": ["CNC Basics", "Tool Setup", "G-Code Reading"],
            "youtube_url": "https://www.youtube.com/embed/WJ6U9ZcZ0mE",
            "duration_minutes": 90,
            "duration_days": 30
        },
        {
            "title": "Quality Control (ISO 9001)", 
            "category": "Quality", "type": "mandatory", "linked_scheme": "PMKVY", "incentive_value": 6000,
            "description": "Introduction to ISO 9001 quality management principles and shop-floor implementations.",
            "skills": ["ISO 9001", "Defect Tracking", "Audit Preparation"],
            "youtube_url": "https://www.youtube.com/embed/d3W8eO5I90k",
            "duration_minutes": 75,
            "duration_days": 20
        },
        {
            "title": "Advanced Manufacturing Layout", 
            "category": "Operations", "type": "role-based", "linked_scheme": "NEEM", "incentive_value": 10000,
            "description": "Understand modern plant layouts, material flow, and basic manufacturing automation.",
            "skills": ["Plant Layouts", "Material Flow", "Automation Basics"],
            "youtube_url": "https://www.youtube.com/embed/5H3fB-H6H3E",
            "duration_minutes": 120,
            "duration_days": 45
        },
        {
            "title": "Lean Six Sigma Fundamentals", 
            "category": "Quality", "type": "role-based", "linked_scheme": "PMKVY", "incentive_value": 12000,
            "description": "Concepts of waste reduction, continuous improvement, and Six Sigma DMAIC framework.",
            "skills": ["DMAIC Framework", "Waste Reduction", "5S Methodology"],
            "youtube_url": "https://www.youtube.com/embed/PcvXqJtX3uE",
            "duration_minutes": 150,
            "duration_days": 60
        },
    ]

    course_ids = []
    for cd in courses_data:
        result = await db.courses.insert_one(cd)
        course_ids.append(str(result.inserted_id))
    print(f"📚 {len(course_ids)} courses created")

    # ---- Assessments ----
    # 5 MCQ questions per course
    for i, cid in enumerate(course_ids):
        questions = [
            {"question": f"Sample assessment question 1 for {courses_data[i]['title']}?", "options": ["Option A", "Option B", "Option C", "Option D"], "correct_answer": 0},
            {"question": f"Sample assessment question 2 for {courses_data[i]['title']}?", "options": ["Option A", "Option B", "Option C", "Option D"], "correct_answer": 1},
            {"question": f"Sample assessment question 3 for {courses_data[i]['title']}?", "options": ["Option A", "Option B", "Option C", "Option D"], "correct_answer": 2},
            {"question": f"Sample assessment question 4 for {courses_data[i]['title']}?", "options": ["Option A", "Option B", "Option C", "Option D"], "correct_answer": 3},
            {"question": f"Sample assessment question 5 for {courses_data[i]['title']}?", "options": ["Option A", "Option B", "Option C", "Option D"], "correct_answer": 0},
        ]
        # Make the first course have realistic PPE questions for demo
        if i == 0:
            questions = [
                {"question": "What does PPE stand for?", "options": ["Personal Protective Equipment", "Process Potential Elements", "Production Plant Engineering", "Part Processing Equipment"], "correct_answer": 0},
                {"question": "Which of these is NOT typically considered PPE?", "options": ["Safety Goggles", "Hard Hat", "High-Visibility Vest", "Office Chair"], "correct_answer": 3},
                {"question": "When should PPE be inspected?", "options": ["Once a year", "Every month", "Before each use", "Only when broken"], "correct_answer": 2},
                {"question": "What is the primary purpose of a hard hat?", "options": ["Keep head warm", "Protect from falling objects", "Identify job role", "Look professional"], "correct_answer": 1},
                {"question": "Who is responsible for properly wearing required PPE?", "options": ["The Supervisor", "The Safety Manager", "The Employee", "The CEO"], "correct_answer": 2},
            ]
            
        await db.assessments.insert_one({
            "course_id": cid,
            "questions": questions
        })
    print(f"📝 {len(course_ids)} assessments created")

    # ---- Progress (assign courses to employees) ----
    progress_count = 0

    for i, emp_id in enumerate(emp_ids):
        # Each employee gets 3-5 courses
        num_courses = random.randint(3, min(5, len(course_ids)))
        assigned = random.sample(range(len(course_ids)), num_courses)

        for j, ci in enumerate(assigned):
            if j == 0:
                status = "completed"
            elif j == 1 and i < 5:
                status = "completed"
            elif j == 2 and i < 3:
                status = "completed"
            else:
                status = random.choice(["in_progress", "not_started"])

            # Simulate somewhat realistic scores
            score = 0
            if status == "completed":
                # passing score >= 60
                options = [60, 80, 100]
                # High scores for older employees to make them eligible, low scores sometimes to test failed
                score = random.choice(options) if i % 4 != 0 else 100

            comp_date = (datetime.utcnow() - timedelta(days=random.randint(5, 60))).isoformat() if status == "completed" else None

            await db.progress.insert_one({
                "user_id": emp_id,
                "course_id": course_ids[ci],
                "status": status,
                "score": score,
                "completed_at": comp_date,
                "assigned_date": (datetime.utcnow() - timedelta(days=random.randint(30, 90))).isoformat(),
            })
            progress_count += 1

    print(f"📊 {progress_count} progress records created")

    # ---- Incentives ----
    incentives_data = [
        {"scheme_name": "NAPS", "required_count": 2, "claimable_amount": 40000, "status": "pending"},
        {"scheme_name": "NEEM", "required_count": 2, "claimable_amount": 72000, "status": "pending"},
        {"scheme_name": "PMKVY", "required_count": 3, "claimable_amount": 108000, "status": "pending"},
    ]

    for inc in incentives_data:
        await db.incentives.insert_one({
            **inc,
            "company_id": company_id,
            "eligible_count": 0,
        })
    print(f"💰 {len(incentives_data)} incentive schemes created")

    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.progress.create_index([("user_id", 1), ("course_id", 1)], unique=True)

    print("\n✅ Seed complete! Login credentials:")
    print("   Admin:    admin@skillsync.com / admin123")
    print("   Employee: rahul@skillsync.com / emp123")

    client.close()



if __name__ == "__main__":
    asyncio.run(seed())
