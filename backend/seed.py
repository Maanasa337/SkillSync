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
            "youtube_url": "https://www.youtube.com/embed/jFDWlKayrTc",
            "duration_minutes": 45,
            "duration_days": 15
        },
        {
            "title": "Fire Safety & Extinguisher Use", 
            "category": "Safety", "type": "mandatory", "linked_scheme": "NAPS", "incentive_value": 3000,
            "description": "Learn the classes of fire, preventative measures, and how to operate various fire extinguishers safely.",
            "skills": ["Fire Classification", "Extinguisher Operation", "Evacuation Planning"],
            "youtube_url": "https://www.youtube.com/embed/PQV71INDaqY",
            "duration_minutes": 60,
            "duration_days": 10
        },
        {
            "title": "CNC Machine Operations & Setup", 
            "category": "Operations", "type": "role-based", "linked_scheme": "NEEM", "incentive_value": 8000,
            "description": "Foundational training on CNC machine operations, tool setup, and basic G-code programming.",
            "skills": ["CNC Basics", "Tool Setup", "G-Code Reading"],
            "youtube_url": "https://www.youtube.com/embed/cj0-wSGGe6g",
            "duration_minutes": 90,
            "duration_days": 30
        },
        {
            "title": "Quality Control (ISO 9001)", 
            "category": "Quality", "type": "mandatory", "linked_scheme": "PMKVY", "incentive_value": 6000,
            "description": "Introduction to ISO 9001 quality management principles and shop-floor implementations.",
            "skills": ["ISO 9001", "Defect Tracking", "Audit Preparation"],
            "youtube_url": "https://www.youtube.com/embed/O5T4H8K_rwQ",
            "duration_minutes": 75,
            "duration_days": 20
        },
        {
            "title": "Advanced Manufacturing Layout", 
            "category": "Operations", "type": "role-based", "linked_scheme": "NEEM", "incentive_value": 10000,
            "description": "Understand modern plant layouts, material flow, and basic manufacturing automation.",
            "skills": ["Plant Layouts", "Material Flow", "Automation Basics"],
            "youtube_url": "https://www.youtube.com/embed/4vq0FKWYud8",
            "duration_minutes": 120,
            "duration_days": 45
        },
        {
            "title": "Lean Six Sigma Fundamentals", 
            "category": "Quality", "type": "role-based", "linked_scheme": "PMKVY", "incentive_value": 12000,
            "description": "Concepts of waste reduction, continuous improvement, and Six Sigma DMAIC framework.",
            "skills": ["DMAIC Framework", "Waste Reduction", "5S Methodology"],
            "youtube_url": "https://www.youtube.com/embed/s2HCrhNVfak",
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
    assessments_data = [
        # Course 0: Industrial Safety Fundamentals
        [
            {"question": "What does PPE stand for?", "options": ["Personal Protective Equipment", "Process Potential Elements", "Production Plant Engineering", "Part Processing Equipment"], "correct_answer": 0},
            {"question": "Which of these is NOT typically considered PPE?", "options": ["Safety Goggles", "Hard Hat", "High-Visibility Vest", "Office Chair"], "correct_answer": 3},
            {"question": "When should PPE be inspected?", "options": ["Once a year", "Every month", "Before each use", "Only when broken"], "correct_answer": 2},
            {"question": "What is the primary purpose of a hard hat?", "options": ["Keep head warm", "Protect from falling objects", "Identify job role", "Look professional"], "correct_answer": 1},
            {"question": "Who is responsible for properly wearing required PPE?", "options": ["The Supervisor", "The Safety Manager", "The Employee", "The CEO"], "correct_answer": 2},
        ],
        # Course 1: Fire Safety & Extinguisher Use
        [
            {"question": "What does the acronym PASS stand for in fire extinguisher use?", "options": ["Point, Aim, Squeeze, Sweep", "Pull, Aim, Squeeze, Sweep", "Pull, Aim, Shoot, Sweep", "Point, Aim, Squeeze, Stop"], "correct_answer": 1},
            {"question": "Which fire class involves ordinary combustibles like wood and paper?", "options": ["Class A", "Class B", "Class C", "Class D"], "correct_answer": 0},
            {"question": "What type of extinguisher is best for electrical fires?", "options": ["Water", "Foam", "CO2", "Wet Chemical"], "correct_answer": 2},
            {"question": "Before fighting a fire, what should you do first?", "options": ["Find an extinguisher", "Ensure alarms are activated and path is clear", "Open all doors", "Turn off lights"], "correct_answer": 1},
            {"question": "Where should you aim the fire extinguisher nozzle?", "options": ["At the top of the flames", "In the middle of the flames", "At the base of the fire", "Around the fire"], "correct_answer": 2},
        ],
        # Course 2: CNC Machine Operations & Setup
        [
            {"question": "What does CNC stand for?", "options": ["Computer Number Core", "Computer Numerical Control", "Central Network Computer", "Calculated Numerical Control"], "correct_answer": 1},
            {"question": "Which programming language is commonly used in CNC?", "options": ["Python", "Java", "G-Code", "C++"], "correct_answer": 2},
            {"question": "What axis typically represents the vertical movement (up and down) in a CNC mill?", "options": ["X-axis", "Y-axis", "Z-axis", "A-axis"], "correct_answer": 2},
            {"question": "What is the tool called that holds the cutting bit?", "options": ["Spindle", "Turret", "Chuck", "Collet"], "correct_answer": 3},
            {"question": "What is 'feed rate' in CNC machining?", "options": ["Speed the spindle rotates", "Speed the tool moves through the material", "Time it takes to boot the machine", "Rate of material cost"], "correct_answer": 1},
        ],
        # Course 3: Quality Control (ISO 9001)
        [
            {"question": "What is ISO 9001 primarily focused on?", "options": ["Environmental Management", "Quality Management Systems", "Occupational Health", "Information Security"], "correct_answer": 1},
            {"question": "Which concept represents continuous improvement in quality?", "options": ["Kaizen", "Kanban", "Poka-yoke", "Heijunka"], "correct_answer": 0},
            {"question": "What is the PDCA cycle?", "options": ["Plan, Do, Check, Act", "Process, Data, Control, Analyze", "Product, Design, Correct, Assess", "Prevent, Detect, Correct, Avoid"], "correct_answer": 0},
            {"question": "Who is responsible for quality under ISO 9001?", "options": ["Only the Quality Manager", "Only Top Management", "Everyone in the organization", "Only the Inspectors"], "correct_answer": 2},
            {"question": "What is an internal audit?", "options": ["An inspection by government", "An evaluation by a customer", "An independent review conducted within the organization", "A financial check"], "correct_answer": 2},
        ],
        # Course 4: Advanced Manufacturing Layout
        [
            {"question": "What is the main goal of plant layout optimization?", "options": ["Increase energy consumption", "Maximize material movement", "Minimize material handling and cost", "Reduce worker breaks"], "correct_answer": 2},
            {"question": "Which layout type groups machines by function?", "options": ["Product layout", "Process layout", "Fixed-position layout", "Cellular layout"], "correct_answer": 1},
            {"question": "In a product layout, how are resources arranged?", "options": ["According to the sequence of operations", "Randomly", "By department", "In a U-shape always"], "correct_answer": 0},
            {"question": "What does 'takt time' refer to?", "options": ["Time taken for lunch breaks", "Rate at which products must be made to meet customer demand", "Time a machine is broken down", "Time to change a tool"], "correct_answer": 1},
            {"question": "Which layout is ideal for ship building?", "options": ["Process layout", "Product layout", "Fixed-position layout", "Assembly line"], "correct_answer": 2},
        ],
        # Course 5: Lean Six Sigma Fundamentals
        [
            {"question": "What does the 'DMAIC' methodology stand for?", "options": ["Design, Make, Assess, Improve, Check", "Define, Measure, Analyze, Improve, Control", "Detect, Monitor, Act, Inform, Correct", "Data, Metrics, Analysis, Ideas, Conclusions"], "correct_answer": 1},
            {"question": "What is the primary focus of 'Lean'?", "options": ["Reducing variation", "Eliminating waste", "Increasing prices", "Hiring more staff"], "correct_answer": 1},
            {"question": "What does Six Sigma primarily aim to reduce?", "options": ["Inventory", "Waste", "Process variation and defects", "Employee turnover"], "correct_answer": 2},
            {"question": "What is a 'Kaizen event'?", "options": ["A company party", "A long-term strategic meeting", "A short, focused improvement project", "A financial audit"], "correct_answer": 2},
            {"question": "In Six Sigma, what does 'DPMO' stand for?", "options": ["Defects Per Million Opportunities", "Days Per Month Operating", "Data Processing Management Office", "Defective Parts Mostly Obsolete"], "correct_answer": 0},
        ]
    ]

    for i, cid in enumerate(course_ids):
        await db.assessments.insert_one({
            "course_id": cid,
            "questions": assessments_data[i]
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
