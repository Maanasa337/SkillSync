"""
SkillSync Seed Script v3
Creates: 1 admin, 60 employees (15/dept), 12 multilingual courses, assignments with deadlines
Includes: date_of_joining distribution, incentive scheme fields, assigned_employee_ids
Idempotent — safe to re-run (uses upsert keyed on email).
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from config import MONGO_URI, DATABASE_NAME
from datetime import datetime, timedelta
from bson import ObjectId
import random

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEPARTMENTS = ["Production", "Quality", "Maintenance", "HR"]

# Language distribution for 60 employees (15 per department):
LANG_PROFILES = (
    [{"primary": "en", "known": ["en"]}] * 20 +
    [{"primary": "en", "known": ["en", "hi"]}] * 10 +
    [{"primary": "hi", "known": ["hi", "en"]}] * 10 +
    [{"primary": "ta", "known": ["ta", "en"]}] * 10 +
    [{"primary": "ta", "known": ["ta", "hi", "en"]}] * 10
)

INDIAN_NAMES = [
    "Rahul Kumar", "Anjali Patel", "Vikram Singh", "Meera Reddy", "Arjun Nair",
    "Kavitha Iyer", "Suresh Babu", "Deepa Menon", "Rajesh Sharma", "Priya Krishnan",
    "Anil Gupta", "Sunita Rao", "Manoj Tiwari", "Lakshmi Devi", "Karthik Subramanian",
    "Pooja Verma", "Sanjay Mishra", "Revathi Sundaram", "Amit Joshi", "Divya Nambiar",
    "Ravi Shankar", "Geeta Pillai", "Vinod Chauhan", "Shalini Mahesh", "Ganesh Murthy",
    "Neha Agarwal", "Prasad Kulkarni", "Anitha Rajan", "Harish Bhat", "Swathi Raghavan",
    "Mohan Das", "Sangeetha Venkat", "Pankaj Yadav", "Usha Kumari", "Vivek Menon",
    "Rekha Srinivasan", "Santosh Patil", "Kamala Devi", "Arun Prakash", "Jayashree Iyengar",
    "Dinesh Choudhury", "Padma Lakshmi", "Naveen Hegde", "Bhavani Shankar", "Ramesh Gowda",
    "Saroja Narayan", "Ashok Malhotra", "Vandana Tripathi", "Sunil Nanda", "Meenakshi Sundaram",
    "Kishore Reddy", "Ganga Devi", "Prakash Jain", "Indira Bose", "Vijay Anand",
    "Chitra Ramachandran", "Girish Kamath", "Hema Latha", "Balaji Srinivas", "Nandini Ganesan",
]

JOB_ROLES = {
    "Production": ["Machine Operator", "Line Supervisor", "Assembly Tech", "CNC Operator", "Welder",
                    "Shift Lead", "Production Engineer", "Material Handler", "Press Operator", "Quality Checker",
                    "Process Technician", "Tooling Specialist", "Foreman", "Crane Operator", "Packaging Lead"],
    "Quality": ["QA Inspector", "Quality Engineer", "Lab Analyst", "Audit Coordinator", "SPC Analyst",
                "Calibration Tech", "Quality Lead", "Document Controller", "Testing Engineer", "Quality Planner",
                "Incoming Inspector", "Final Inspector", "NDT Specialist", "Quality Supervisor", "Metrology Tech"],
    "Maintenance": ["Electrician", "Mechanic", "HVAC Tech", "Plumber", "Maintenance Planner",
                    "PLC Programmer", "Reliability Engineer", "Lubrication Tech", "Boiler Operator", "Instrument Tech",
                    "Maintenance Supervisor", "Millwright", "Welder-Fitter", "Stores Keeper", "Safety Technician"],
    "HR": ["HR Coordinator", "Recruiter", "Training Coordinator", "Payroll Specialist", "Benefits Admin",
           "HR Analyst", "Employee Relations", "Compliance Officer", "HR Assistant", "Talent Acquisition",
           "Learning Specialist", "Comp & Benefits", "HRIS Analyst", "Safety Officer", "Admin Executive"],
}


def generate_date_of_joining(dept_index: int, emp_index_in_dept: int) -> str:
    """
    Generate realistic date_of_joining spread across last 3 years.
    Per department (15 employees):
      - 5 employees: joined < 6 months ago
      - 5 employees: joined 6-12 months ago
      - 5 employees: joined 1-3 years ago
    """
    now = datetime.utcnow()
    if emp_index_in_dept < 5:
        # Joined < 6 months ago (30–170 days)
        days_ago = random.randint(30, 170)
    elif emp_index_in_dept < 10:
        # Joined 6-12 months ago (180–360 days)
        days_ago = random.randint(180, 360)
    else:
        # Joined 1-3 years ago (370–1095 days)
        days_ago = random.randint(370, 1095)

    doj = now - timedelta(days=days_ago)
    return doj.isoformat()


def build_courses():
    """12 courses: 3 per department theme with full multilingual content."""
    return [
        # ---- Production Courses (3) ----
        {
            "title": {"en": "Industrial Safety Fundamentals", "hi": "औद्योगिक सुरक्षा की मूल बातें", "ta": "தொழிற்சாலை பாதுகாப்பு அடிப்படைகள்"},
            "description": {
                "en": "Comprehensive guide to industrial safety protocols, hazard identification, and emergency response procedures in manufacturing environments.",
                "hi": "विनिर्माण वातावरण में औद्योगिक सुरक्षा प्रोटोकॉल, खतरे की पहचान और आपातकालीन प्रतिक्रिया प्रक्रियाओं के लिए व्यापक मार्गदर्शिका।",
                "ta": "உற்பத்தி சூழலில் தொழிற்சாலை பாதுகாப்பு நெறிமுறைகள், ஆபத்து அடையாளம் மற்றும் அவசர நடவடிக்கை முறைகளுக்கான விரிவான வழிகாட்டி."
            },
            "youtube_link": {
                "en": "https://www.youtube.com/embed/pdFFoR9mhPk",
                "hi": "https://www.youtube.com/embed/EvLMnOJFMbM",
                "ta": "https://www.youtube.com/embed/wZsDR5LyGi8"
            },
            "training_mode": "classroom",
            "category": "Safety",
            "type": "mandatory", "linked_scheme": "NAPS", "incentive_value": 5000,
            "skills": ["Hazard Identification", "PPE Usage", "Emergency Response"],
            "duration_minutes": 45, "duration_days": 15
        },
        {
            "title": {"en": "CNC Machine Operations & Setup", "hi": "सीएनसी मशीन संचालन और सेटअप", "ta": "CNC இயந்திர செயல்பாடுகள் மற்றும் அமைப்பு"},
            "description": {
                "en": "Hands-on training on CNC machine operations, tool setup, G-code programming, and precision machining techniques.",
                "hi": "सीएनसी मशीन संचालन, उपकरण सेटअप, जी-कोड प्रोग्रामिंग और सटीक मशीनिंग तकनीकों पर व्यावहारिक प्रशिक्षण।",
                "ta": "CNC இயந்திர செயல்பாடுகள், கருவி அமைப்பு, G-code நிரலாக்கம் மற்றும் துல்லிய இயந்திர நுட்பங்கள் பற்றிய நடைமுறை பயிற்சி."
            },
            "youtube_link": {
                "en": "https://www.youtube.com/embed/RnIvhlKT7SY",
                "hi": "https://www.youtube.com/embed/l_1HE7ASHO8",
                "ta": "https://www.youtube.com/embed/Mr8TmZ7zg0Q"
            },
            "training_mode": "offline",
            "category": "Operations",
            "type": "role-based", "linked_scheme": "NEEM", "incentive_value": 8000,
            "skills": ["CNC Basics", "Tool Setup", "G-Code Reading"],
            "duration_minutes": 90, "duration_days": 30
        },
        {
            "title": {"en": "Advanced Manufacturing Layout", "hi": "उन्नत विनिर्माण लेआउट", "ta": "மேம்பட்ட உற்பத்தி தளவமைப்பு"},
            "description": {
                "en": "Understand modern plant layouts, material flow optimization, and basic manufacturing automation principles.",
                "hi": "आधुनिक प्लांट लेआउट, सामग्री प्रवाह अनुकूलन और बुनियादी विनिर्माण स्वचालन सिद्धांतों को समझें।",
                "ta": "நவீன ஆலை தளவமைப்புகள், பொருள் ஓட்ட மேம்படுத்தல் மற்றும் அடிப்படை உற்பத்தி தானியங்கி கொள்கைகளைப் புரிந்துகொள்ளுங்கள்."
            },
            "youtube_link": {
                "en": "https://www.youtube.com/embed/Se4sclQLsrc",
                "hi": "https://www.youtube.com/embed/PjXo-3Y176w",
                "ta": "https://www.youtube.com/embed/W9gHIdfkQF0"
            },
            "training_mode": "online",
            "category": "Operations",
            "type": "role-based", "linked_scheme": "NEEM", "incentive_value": 10000,
            "skills": ["Plant Layouts", "Material Flow", "Automation Basics"],
            "duration_minutes": 120, "duration_days": 45
        },

        # ---- Quality Courses (3) ----
        {
            "title": {"en": "Quality Control (ISO 9001)", "hi": "गुणवत्ता नियंत्रण (ISO 9001)", "ta": "தரக் கட்டுப்பாடு (ISO 9001)"},
            "description": {
                "en": "Introduction to ISO 9001 quality management systems, audit preparation, and defect tracking methodologies.",
                "hi": "ISO 9001 गुणवत्ता प्रबंधन प्रणालियों, ऑडिट तैयारी और दोष ट्रैकिंग पद्धतियों का परिचय।",
                "ta": "ISO 9001 தர மேலாண்மை அமைப்புகள், தணிக்கை தயாரிப்பு மற்றும் குறைபாடு கண்காணிப்பு முறைகளின் அறிமுகம்."
            },
            "youtube_link": {
                "en": "https://www.youtube.com/embed/aRqMaOqfVP8",
                "hi": "https://www.youtube.com/embed/J9L3OHpVcJY",
                "ta": "https://www.youtube.com/embed/4XPFi13-hrQ"
            },
            "training_mode": "self-paced",
            "category": "Quality",
            "type": "mandatory", "linked_scheme": "PMKVY", "incentive_value": 6000,
            "skills": ["ISO 9001", "Defect Tracking", "Audit Preparation"],
            "duration_minutes": 75, "duration_days": 20
        },
        {
            "title": {"en": "Lean Six Sigma Fundamentals", "hi": "लीन सिक्स सिग्मा की मूल बातें", "ta": "லீன் சிக்ஸ் சிக்மா அடிப்படைகள்"},
            "description": {
                "en": "Learn waste reduction, continuous improvement, DMAIC framework, and 5S methodology for manufacturing excellence.",
                "hi": "विनिर्माण उत्कृष्टता के लिए अपशिष्ट कमी, निरंतर सुधार, DMAIC फ्रेमवर्क और 5S पद्धति सीखें।",
                "ta": "உற்பத்தி சிறப்புக்கான கழிவு குறைப்பு, தொடர் மேம்பாடு, DMAIC கட்டமைப்பு மற்றும் 5S முறையியலைக் கற்றுக்கொள்ளுங்கள்."
            },
            "youtube_link": {
                "en": "https://www.youtube.com/embed/jQ-sME1nufg",
                "hi": "https://www.youtube.com/embed/R8dYLbJdP6E",
                "ta": "https://www.youtube.com/embed/dFPHjdq0CaU"
            },
            "training_mode": "online",
            "category": "Quality",
            "type": "role-based", "linked_scheme": "PMKVY", "incentive_value": 12000,
            "skills": ["DMAIC Framework", "Waste Reduction", "5S Methodology"],
            "duration_minutes": 150, "duration_days": 60
        },
        {
            "title": {"en": "Statistical Process Control", "hi": "सांख्यिकीय प्रक्रिया नियंत्रण", "ta": "புள்ளிவிவர செயல்முறை கட்டுப்பாடு"},
            "description": {
                "en": "Master SPC charts, control limits, capability indices (Cp/Cpk), and data-driven quality decisions.",
                "hi": "SPC चार्ट, नियंत्रण सीमाएं, क्षमता सूचकांक (Cp/Cpk) और डेटा-संचालित गुणवत्ता निर्णयों में महारत हासिल करें।",
                "ta": "SPC விளக்கப்படங்கள், கட்டுப்பாட்டு வரம்புகள், திறன் குறியீடுகள் (Cp/Cpk) மற்றும் தரவு சார்ந்த தர முடிவுகளில் தேர்ச்சி பெறுங்கள்."
            },
            "youtube_link": {
                "en": "https://www.youtube.com/embed/1FhnXngRGBs",
                "hi": "https://www.youtube.com/embed/jRhVkxPGik0",
                "ta": "https://www.youtube.com/embed/AXXEQ-WZzKQ"
            },
            "training_mode": "classroom",
            "category": "Quality",
            "type": "mandatory", "linked_scheme": "PMKVY", "incentive_value": 7000,
            "skills": ["Control Charts", "Cp/Cpk Analysis", "Data Analysis"],
            "duration_minutes": 60, "duration_days": 14
        },

        # ---- Maintenance Courses (3) ----
        {
            "title": {"en": "Preventive Maintenance Essentials", "hi": "निवारक रखरखाव की अनिवार्यताएं", "ta": "தடுப்பு பராமரிப்பு அடிப்படைகள்"},
            "description": {
                "en": "Learn scheduled maintenance planning, equipment inspection techniques, and breakdown prevention strategies.",
                "hi": "निर्धारित रखरखाव योजना, उपकरण निरीक्षण तकनीक और ब्रेकडाउन रोकथाम रणनीतियों को सीखें।",
                "ta": "திட்டமிடப்பட்ட பராமரிப்பு திட்டமிடல், உபகரண ஆய்வு நுட்பங்கள் மற்றும் செயலிழப்பு தடுப்பு உத்திகளைக் கற்றுக்கொள்ளுங்கள்."
            },
            "youtube_link": {
                "en": "https://www.youtube.com/embed/9V33LnPqpJE",
                "hi": "https://www.youtube.com/embed/Qq_B9In-LX8",
                "ta": "https://www.youtube.com/embed/3z_RyMF6C00"
            },
            "training_mode": "offline",
            "category": "Maintenance",
            "type": "mandatory", "linked_scheme": None, "incentive_value": 0,
            "skills": ["PM Planning", "Equipment Inspection", "Root Cause Analysis"],
            "duration_minutes": 60, "duration_days": 14
        },
        {
            "title": {"en": "Electrical Safety & Troubleshooting", "hi": "विद्युत सुरक्षा और समस्या निवारण", "ta": "மின் பாதுகாப்பு மற்றும் சரிசெய்தல்"},
            "description": {
                "en": "Electrical safety protocols, lockout/tagout procedures, panel troubleshooting, and motor maintenance.",
                "hi": "विद्युत सुरक्षा प्रोटोकॉल, लॉकआउट/टैगआउट प्रक्रियाएं, पैनल समस्या निवारण और मोटर रखरखाव।",
                "ta": "மின் பாதுகாப்பு நெறிமுறைகள், லாக்அவுட்/டேகவுட் நடைமுறைகள், பேனல் சரிசெய்தல் மற்றும் மோட்டார் பராமரிப்பு."
            },
            "youtube_link": {
                "en": "https://www.youtube.com/embed/2aYsHj9YbAU",
                "hi": "https://www.youtube.com/embed/7jpDFBSFnhA",
                "ta": "https://www.youtube.com/embed/tPsrc8FoxIw"
            },
            "training_mode": "classroom",
            "category": "Maintenance",
            "type": "mandatory", "linked_scheme": None, "incentive_value": 0,
            "skills": ["LOTO Procedures", "Panel Diagnostics", "Motor Maintenance"],
            "duration_minutes": 90, "duration_days": 21
        },
        {
            "title": {"en": "PLC Programming Basics", "hi": "PLC प्रोग्रामिंग की मूल बातें", "ta": "PLC நிரலாக்க அடிப்படைகள்"},
            "description": {
                "en": "Introduction to PLC hardware, ladder logic programming, I/O configuration, and basic automation projects.",
                "hi": "PLC हार्डवेयर, लैडर लॉजिक प्रोग्रामिंग, I/O कॉन्फ़िगरेशन और बुनियादी ऑटोमेशन प्रोजेक्ट का परिचय।",
                "ta": "PLC வன்பொருள், ஏணி தர்க்க நிரலாக்கம், I/O கட்டமைப்பு மற்றும் அடிப்படை தானியங்கி திட்டங்களின் அறிமுகம்."
            },
            "youtube_link": {
                "en": "https://www.youtube.com/embed/WR9FRFQ9GzI",
                "hi": "https://www.youtube.com/embed/VcJu30tyNMw",
                "ta": "https://www.youtube.com/embed/P3T0xKePE-8"
            },
            "training_mode": "self-paced",
            "category": "Maintenance",
            "type": "role-based", "linked_scheme": None, "incentive_value": 0,
            "skills": ["Ladder Logic", "I/O Configuration", "HMI Basics"],
            "duration_minutes": 120, "duration_days": 30
        },

        # ---- HR Courses (3) ----
        {
            "title": {"en": "Workplace Communication Skills", "hi": "कार्यस्थल संचार कौशल", "ta": "பணியிட தகவல்தொடர்பு திறன்கள்"},
            "description": {
                "en": "Effective communication in manufacturing environments: team briefings, incident reporting, and cross-functional collaboration.",
                "hi": "विनिर्माण वातावरण में प्रभावी संचार: टीम ब्रीफिंग, घटना रिपोर्टिंग और क्रॉस-फंक्शनल सहयोग।",
                "ta": "உற்பத்தி சூழலில் பயனுள்ள தகவல் தொடர்பு: குழு விளக்கங்கள், சம்பவ அறிக்கையிடல் மற்றும் குறுக்கு-செயல்பாட்டு ஒத்துழைப்பு."
            },
            "youtube_link": {
                "en": "https://www.youtube.com/embed/HAnw168huqA",
                "hi": "https://www.youtube.com/embed/8T4K0kxNHl0",
                "ta": "https://www.youtube.com/embed/4MnJvMC-tRk"
            },
            "training_mode": "online",
            "category": "HR",
            "type": "mandatory", "linked_scheme": None, "incentive_value": 0,
            "skills": ["Team Communication", "Incident Reporting", "Presentation"],
            "duration_minutes": 45, "duration_days": 7
        },
        {
            "title": {"en": "Fire Safety & Extinguisher Use", "hi": "अग्नि सुरक्षा और बुझाने का उपयोग", "ta": "தீ பாதுகாப்பு மற்றும் தீயணைப்பான் பயன்பாடு"},
            "description": {
                "en": "Learn fire classifications, prevention measures, PASS technique for extinguisher operation, and evacuation procedures.",
                "hi": "अग्नि वर्गीकरण, रोकथाम उपाय, बुझाने के संचालन के लिए PASS तकनीक और निकासी प्रक्रियाएं सीखें।",
                "ta": "தீ வகைப்பாடுகள், தடுப்பு நடவடிக்கைகள், தீயணைப்பான் இயக்கத்திற்கான PASS நுட்பம் மற்றும் வெளியேற்ற நடைமுறைகளைக் கற்றுக்கொள்ளுங்கள்."
            },
            "youtube_link": {
                "en": "https://www.youtube.com/embed/8zCBbFEGiVo",
                "hi": "https://www.youtube.com/embed/_cqJjuXwBQo",
                "ta": "https://www.youtube.com/embed/nR9YPCdy4Lo"
            },
            "training_mode": "offline",
            "category": "Safety",
            "type": "mandatory", "linked_scheme": "NAPS", "incentive_value": 3000,
            "skills": ["Fire Classification", "Extinguisher Operation", "Evacuation Planning"],
            "duration_minutes": 60, "duration_days": 10
        },
        {
            "title": {"en": "Compliance & Labor Law Awareness", "hi": "अनुपालन और श्रम कानून जागरूकता", "ta": "இணக்கம் மற்றும் தொழிலாளர் சட்ட விழிப்புணர்வு"},
            "description": {
                "en": "Overview of key labor laws, workplace compliance requirements, employee rights, and organizational policies.",
                "hi": "प्रमुख श्रम कानूनों, कार्यस्थल अनुपालन आवश्यकताओं, कर्मचारी अधिकारों और संगठनात्मक नीतियों का अवलोकन।",
                "ta": "முக்கிய தொழிலாளர் சட்டங்கள், பணியிட இணக்கத் தேவைகள், ஊழியர் உரிமைகள் மற்றும் நிறுவனக் கொள்கைகளின் கண்ணோட்டம்."
            },
            "youtube_link": {
                "en": "https://www.youtube.com/embed/CYCnbJAkQ4I",
                "hi": "https://www.youtube.com/embed/Pj5_g_kWi1k",
                "ta": "https://www.youtube.com/embed/E0eMCXW-3PQ"
            },
            "training_mode": "self-paced",
            "category": "HR",
            "type": "mandatory", "linked_scheme": None, "incentive_value": 0,
            "skills": ["Labor Laws", "Compliance", "Employee Rights"],
            "duration_minutes": 40, "duration_days": 7
        },
        # ---- New Safety Courses (2) ----
        {
            "title": {"en": "Chemical Safety Training", "hi": "रासायनिक सुरक्षा प्रशिक्षण", "ta": "இரசாயன பாதுகாப்பு பயிற்சி"},
            "description": {
                "en": "Learn proper handling, storage, and emergency response for hazardous chemicals.",
                "hi": "खतरनाक रसायनों के उचित प्रबंधन, भंडारण और आपातकालीन प्रतिक्रिया के बारे में जानें।",
                "ta": "அபாயகரமான இரசாயனங்களை முறையாக கையாளுதல், சேமிப்பு மற்றும் அவசரகால பதில் பற்றி அறியவும்."
            },
            "youtube_link": {
                "en": "https://www.youtube.com/embed/n431Bts_W0A",
                "hi": "https://www.youtube.com/embed/n431Bts_W0A",
                "ta": "https://www.youtube.com/embed/n431Bts_W0A"
            },
            "training_mode": "online",
            "category": "Safety",
            "type": "mandatory", "linked_scheme": None, "incentive_value": 0,
            "skills": ["Chemical Handling", "Spill Response", "Hazard Identification"],
            "duration_minutes": 45, "duration_days": 10
        },
        {
            "title": {"en": "Heat Stress Training", "hi": "गर्मी का तनाव प्रशिक्षण", "ta": "வெப்ப அழுத்தப் பயிற்சி"},
            "description": {
                "en": "Recognize the signs of heat stress, prevention techniques, and hydration strategies in hot environments.",
                "hi": "गर्म वातावरण में गर्मी के तनाव के लक्षण, रोकथाम की तकनीक और जलयोजन रणनीतियों को पहचानें।",
                "ta": "வெப்பமான சூழலில் வெப்ப அழுத்தத்தின் அறிகுறிகள், தடுப்பு நுட்பங்கள் மற்றும் நீரேற்றம் உத்திகளை அங்கீகரிக்கவும்."
            },
            "youtube_link": {
                "en": "https://www.youtube.com/embed/U9sZ9JcTjV0",
                "hi": "https://www.youtube.com/embed/U9sZ9JcTjV0",
                "ta": "https://www.youtube.com/embed/U9sZ9JcTjV0"
            },
            "training_mode": "online",
            "category": "Safety",
            "type": "mandatory", "linked_scheme": None, "incentive_value": 0,
            "skills": ["Heat Stress Prevention", "Hydration", "First Aid"],
            "duration_minutes": 30, "duration_days": 7
        },
    ]


def build_assessments():
    """5 MCQ questions per course, matching course indices."""
    return [
        # Course 0: Industrial Safety Fundamentals
        [
            {"question": "What does PPE stand for?", "options": ["Personal Protective Equipment", "Process Potential Elements", "Production Plant Engineering", "Part Processing Equipment"], "correct_answer": 0},
            {"question": "Which of these is NOT typically considered PPE?", "options": ["Safety Goggles", "Hard Hat", "High-Visibility Vest", "Office Chair"], "correct_answer": 3},
            {"question": "When should PPE be inspected?", "options": ["Once a year", "Every month", "Before each use", "Only when broken"], "correct_answer": 2},
            {"question": "What is the primary purpose of a hard hat?", "options": ["Keep head warm", "Protect from falling objects", "Identify job role", "Look professional"], "correct_answer": 1},
            {"question": "Who is responsible for properly wearing required PPE?", "options": ["The Supervisor", "The Safety Manager", "The Employee", "The CEO"], "correct_answer": 2},
        ],
        # Course 1: CNC Machine Operations
        [
            {"question": "What does CNC stand for?", "options": ["Computer Number Core", "Computer Numerical Control", "Central Network Computer", "Calculated Numerical Control"], "correct_answer": 1},
            {"question": "Which programming language is commonly used in CNC?", "options": ["Python", "Java", "G-Code", "C++"], "correct_answer": 2},
            {"question": "What axis represents vertical movement in a CNC mill?", "options": ["X-axis", "Y-axis", "Z-axis", "A-axis"], "correct_answer": 2},
            {"question": "What holds the cutting bit in CNC?", "options": ["Spindle", "Turret", "Chuck", "Collet"], "correct_answer": 3},
            {"question": "What is 'feed rate' in CNC machining?", "options": ["Speed the spindle rotates", "Speed the tool moves through material", "Time to boot the machine", "Rate of material cost"], "correct_answer": 1},
        ],
        # Course 2: Advanced Manufacturing Layout
        [
            {"question": "What is the main goal of plant layout optimization?", "options": ["Increase energy consumption", "Maximize material movement", "Minimize material handling and cost", "Reduce worker breaks"], "correct_answer": 2},
            {"question": "Which layout type groups machines by function?", "options": ["Product layout", "Process layout", "Fixed-position layout", "Cellular layout"], "correct_answer": 1},
            {"question": "In a product layout, how are resources arranged?", "options": ["According to the sequence of operations", "Randomly", "By department", "In a U-shape always"], "correct_answer": 0},
            {"question": "What does 'takt time' refer to?", "options": ["Time taken for lunch breaks", "Rate to meet customer demand", "Time a machine is broken down", "Time to change a tool"], "correct_answer": 1},
            {"question": "Which layout is ideal for ship building?", "options": ["Process layout", "Product layout", "Fixed-position layout", "Assembly line"], "correct_answer": 2},
        ],
        # Course 3: Quality Control (ISO 9001)
        [
            {"question": "What is ISO 9001 primarily focused on?", "options": ["Environmental Management", "Quality Management Systems", "Occupational Health", "Information Security"], "correct_answer": 1},
            {"question": "Which concept represents continuous improvement?", "options": ["Kaizen", "Kanban", "Poka-yoke", "Heijunka"], "correct_answer": 0},
            {"question": "What is the PDCA cycle?", "options": ["Plan, Do, Check, Act", "Process, Data, Control, Analyze", "Product, Design, Correct, Assess", "Prevent, Detect, Correct, Avoid"], "correct_answer": 0},
            {"question": "Who is responsible for quality under ISO 9001?", "options": ["Only the Quality Manager", "Only Top Management", "Everyone in the organization", "Only the Inspectors"], "correct_answer": 2},
            {"question": "What is an internal audit?", "options": ["An inspection by government", "An evaluation by a customer", "An independent review within the organization", "A financial check"], "correct_answer": 2},
        ],
        # Course 4: Lean Six Sigma
        [
            {"question": "What does DMAIC stand for?", "options": ["Design, Make, Assess, Improve, Check", "Define, Measure, Analyze, Improve, Control", "Detect, Monitor, Act, Inform, Correct", "Data, Metrics, Analysis, Ideas, Conclusions"], "correct_answer": 1},
            {"question": "What is the primary focus of Lean?", "options": ["Reducing variation", "Eliminating waste", "Increasing prices", "Hiring more staff"], "correct_answer": 1},
            {"question": "What does Six Sigma aim to reduce?", "options": ["Inventory", "Waste", "Process variation and defects", "Employee turnover"], "correct_answer": 2},
            {"question": "What is a Kaizen event?", "options": ["A company party", "A long-term strategic meeting", "A short, focused improvement project", "A financial audit"], "correct_answer": 2},
            {"question": "What does DPMO stand for?", "options": ["Defects Per Million Opportunities", "Days Per Month Operating", "Data Processing Management Office", "Defective Parts Mostly Obsolete"], "correct_answer": 0},
        ],
        # Course 5: Statistical Process Control
        [
            {"question": "What is SPC primarily used for?", "options": ["Financial tracking", "Monitoring process stability", "Employee evaluation", "Sales forecasting"], "correct_answer": 1},
            {"question": "What chart tracks attribute data (pass/fail)?", "options": ["X-bar chart", "R chart", "p-chart", "Histogram"], "correct_answer": 2},
            {"question": "What does Cpk measure?", "options": ["Machine speed", "Process capability relative to specs", "Employee competency", "Production volume"], "correct_answer": 1},
            {"question": "UCL stands for:", "options": ["Under Control Limit", "Upper Control Limit", "Universal Control Level", "Uniform Check List"], "correct_answer": 1},
            {"question": "A process is 'in control' when:", "options": ["All points are within control limits", "Output is zero defects", "Cpk > 2.0", "No complaints"], "correct_answer": 0},
        ],
        # Course 6: Preventive Maintenance
        [
            {"question": "What is preventive maintenance?", "options": ["Fixing after breakdown", "Scheduled maintenance to prevent failures", "Only cleaning equipment", "Replacing all parts monthly"], "correct_answer": 1},
            {"question": "What does MTBF stand for?", "options": ["Mean Time Between Failures", "Maximum Time Before Fix", "Minimum Testing Before Function", "Motor Timing Before Finish"], "correct_answer": 0},
            {"question": "Which is NOT a PM activity?", "options": ["Oil changes", "Vibration analysis", "Emergency repairs", "Filter replacement"], "correct_answer": 2},
            {"question": "What tool helps prioritize maintenance tasks?", "options": ["FMEA", "Balance sheet", "Marketing plan", "Org chart"], "correct_answer": 0},
            {"question": "PM schedules are typically based on:", "options": ["Management mood", "Time or usage intervals", "Customer complaints", "Budget availability"], "correct_answer": 1},
        ],
        # Course 7: Electrical Safety
        [
            {"question": "What is LOTO?", "options": ["Light Out Turn Off", "Lockout/Tagout", "Load Output Test Operation", "Low Overhead Testing Operation"], "correct_answer": 1},
            {"question": "Before working on electrical panels, you must:", "options": ["Wear gloves only", "Apply LOTO procedures", "Get verbal permission", "Turn off lights"], "correct_answer": 1},
            {"question": "What voltage is considered hazardous?", "options": ["Any voltage > 50V", "Only > 1000V", "Only > 240V", "Only DC voltage"], "correct_answer": 0},
            {"question": "A GFCI protects against:", "options": ["Overloading", "Ground faults / electrocution", "Voltage spikes", "Power outages"], "correct_answer": 1},
            {"question": "Who can remove a lockout device?", "options": ["Any employee", "The supervisor only", "Only the person who applied it", "The electrician"], "correct_answer": 2},
        ],
        # Course 8: PLC Programming
        [
            {"question": "What does PLC stand for?", "options": ["Power Line Controller", "Programmable Logic Controller", "Process Logic Computer", "Planned Logic Circuit"], "correct_answer": 1},
            {"question": "Ladder logic is based on:", "options": ["Python syntax", "Relay logic diagrams", "HTML structure", "Flowcharts"], "correct_answer": 1},
            {"question": "What is an I/O module?", "options": ["Internet device", "Input/Output interface", "Internal Operating module", "Instruction Organizer"], "correct_answer": 1},
            {"question": "NO contact in ladder logic means:", "options": ["No connection", "Normally Open", "Not Operational", "Number Only"], "correct_answer": 1},
            {"question": "PLC scan cycle includes:", "options": ["Read inputs, execute program, update outputs", "Only reading inputs", "Only updating outputs", "Random execution"], "correct_answer": 0},
        ],
        # Course 9: Workplace Communication
        [
            {"question": "Effective team briefing should be:", "options": ["Long and detailed", "Short, clear, and relevant", "Only written", "Monthly only"], "correct_answer": 1},
            {"question": "Incident reports should include:", "options": ["Only the date", "What, where, when, who, and how", "Only the person's name", "Only the solution"], "correct_answer": 1},
            {"question": "Active listening means:", "options": ["Nodding constantly", "Fully concentrating and responding", "Interrupting with questions", "Writing everything down"], "correct_answer": 1},
            {"question": "Cross-functional collaboration is:", "options": ["Working alone", "Teams from different departments working together", "Only management meetings", "Customer feedback"], "correct_answer": 1},
            {"question": "The best way to resolve workplace conflict is:", "options": ["Ignoring it", "Escalating immediately", "Open discussion and compromise", "Transferring employees"], "correct_answer": 2},
        ],
        # Course 10: Fire Safety
        [
            {"question": "What does PASS stand for in extinguisher use?", "options": ["Point, Aim, Squeeze, Sweep", "Pull, Aim, Squeeze, Sweep", "Pull, Aim, Shoot, Sweep", "Point, Aim, Squeeze, Stop"], "correct_answer": 1},
            {"question": "Which fire class involves ordinary combustibles?", "options": ["Class A", "Class B", "Class C", "Class D"], "correct_answer": 0},
            {"question": "What extinguisher is best for electrical fires?", "options": ["Water", "Foam", "CO2", "Wet Chemical"], "correct_answer": 2},
            {"question": "Before fighting a fire, you should:", "options": ["Find an extinguisher", "Ensure alarms are activated and path is clear", "Open all doors", "Turn off lights"], "correct_answer": 1},
            {"question": "Where should you aim the extinguisher nozzle?", "options": ["Top of flames", "Middle of flames", "Base of the fire", "Around the fire"], "correct_answer": 2},
        ],
        # Course 11: Compliance & Labor Law
        [
            {"question": "The Factories Act 1948 applies to:", "options": ["Only IT companies", "Manufacturing units with 10+ workers using power", "All businesses", "Only government offices"], "correct_answer": 1},
            {"question": "Minimum working age in factories in India is:", "options": ["12 years", "14 years", "16 years", "18 years"], "correct_answer": 1},
            {"question": "Maximum weekly working hours under Indian law:", "options": ["40 hours", "48 hours", "56 hours", "60 hours"], "correct_answer": 1},
            {"question": "EPF stands for:", "options": ["Employee Pension Fund", "Employees' Provident Fund", "Enterprise Performance Fund", "Employment Protection Fee"], "correct_answer": 1},
            {"question": "POSH Act deals with:", "options": ["Environmental safety", "Prevention of sexual harassment at workplace", "Product quality", "Fire safety"], "correct_answer": 1},
        ],
        # Course 12: Chemical Safety Training
        [
            {"question": "What is an SDS?", "options": ["Safety Data Sheet", "System Design Specification", "Standard Delivery Service", "Secure Data Storage"], "correct_answer": 0},
            {"question": "When handling hazardous chemicals, what is the most important PPE?", "options": ["Hard Hat", "Chemical-resistant gloves and goggles", "Steel-toe boots", "Earplugs"], "correct_answer": 1},
            {"question": "What should you do in case of a minor chemical spill?", "options": ["Ignore it", "Report it and clean it up using the spill kit", "Wash it down the drain", "Evacuate the building"], "correct_answer": 1},
            {"question": "Where should flammable liquids be stored?", "options": ["In a standard cabinet", "In a designated flammable storage cabinet", "On the floor", "Next to the exit"], "correct_answer": 1},
            {"question": "If a chemical splashes in your eyes, how long should you rinse them at an eyewash station?", "options": ["1 minute", "5 minutes", "At least 15 minutes", "30 minutes"], "correct_answer": 2},
        ],
        # Course 13: Heat Stress Training
        [
            {"question": "Which of these is a symptom of heat exhaustion?", "options": ["Shivering", "Heavy sweating and weakness", "Blue lips", "Loss of hearing"], "correct_answer": 1},
            {"question": "What is the best way to prevent heat stress?", "options": ["Drink plenty of water and take breaks in the shade", "Drink coffee", "Wear heavy clothing", "Skip lunch"], "correct_answer": 0},
            {"question": "Is heat stroke a medical emergency?", "options": ["No, just rest", "Yes, call for emergency medical help immediately", "Only if the person is older", "Only in the summer"], "correct_answer": 1},
            {"question": "Which of the following makes you more susceptible to heat stress?", "options": ["Drinking water", "Lack of acclimatization", "Eating a balanced diet", "Wearing a hat"], "correct_answer": 1},
            {"question": "What should you do if a coworker shows signs of heat stroke?", "options": ["Give them a hot drink", "Move them to a cool area and call for help", "Tell them to work faster", "Ignore them"], "correct_answer": 1},
        ],
    ]


async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DATABASE_NAME]

    # Clear existing data
    for col in ["users", "companies", "courses", "progress", "incentives", "assessments", "chatbot_conversations"]:
        await db[col].drop()
    print("Cleared existing data")

    # ---- Company ----
    company = await db.companies.insert_one({
        "name": "PrecisionTech Manufacturing",
        "total_employees": 60,
    })
    company_id = str(company.inserted_id)
    print(f"Company created: PrecisionTech Manufacturing")

    # ---- Admin ----
    admin = await db.users.insert_one({
        "name": "Priya Sharma",
        "email": "admin@skillsync.com",
        "password": pwd_context.hash("admin123"),
        "role": "admin",
        "company_id": company_id,
        "job_role": "HR Manager",
        "department": "HR",
        "primary_language": "en",
        "known_languages": ["en", "hi", "ta"],
        "date_of_joining": (datetime.utcnow() - timedelta(days=1200)).isoformat(),
    })
    print(f"Admin created: admin@skillsync.com / admin123")

    # ---- Employees (60 total, 15 per department) ----
    random.shuffle(LANG_PROFILES)
    name_pool = list(INDIAN_NAMES)
    random.shuffle(name_pool)

    emp_ids = []
    emp_data_list = []
    emp_idx = 0

    for dept_idx, dept in enumerate(DEPARTMENTS):
        dept_roles = JOB_ROLES[dept]
        for i in range(15):
            name = name_pool[emp_idx]
            email_base = name.lower().replace(" ", "")
            email = f"{email_base}@skillsync.com"
            lang_profile = LANG_PROFILES[emp_idx]

            # Generate date_of_joining with proper distribution
            doj = generate_date_of_joining(dept_idx, i)

            result = await db.users.insert_one({
                "name": name,
                "email": email,
                "password": pwd_context.hash("emp123"),
                "role": "employee",
                "company_id": company_id,
                "job_role": dept_roles[i],
                "department": dept,
                "primary_language": lang_profile["primary"],
                "known_languages": lang_profile["known"],
                "training_start_date": (datetime.utcnow() - timedelta(days=random.randint(60, 270))).isoformat(),
                "date_of_joining": doj,
            })
            eid = str(result.inserted_id)
            emp_ids.append(eid)
            emp_data_list.append({
                "id": eid,
                "department": dept,
                "primary_language": lang_profile["primary"],
                "known_languages": lang_profile["known"],
            })
            emp_idx += 1

    print(f"{len(emp_ids)} employees created (password: emp123)")

    # ---- Courses (12) ----
    courses_data = build_courses()
    course_ids = []
    for cd in courses_data:
        cd["materials"] = []  # Initialize empty materials array
        result = await db.courses.insert_one(cd)
        course_ids.append(str(result.inserted_id))
    print(f"{len(course_ids)} courses created (with materials:[])")

    # ---- Assessments ----
    assessments_data = build_assessments()
    for i, cid in enumerate(course_ids):
        await db.assessments.insert_one({
            "course_id": cid,
            "questions": assessments_data[i]
        })
    print(f"{len(course_ids)} assessments created")

    # ---- Assignments / Progress (3-5 courses per employee) ----
    progress_count = 0
    now = datetime.utcnow()

    for emp_info in emp_data_list:
        emp_id = emp_info["id"]
        emp_lang = emp_info["primary_language"]

        num_courses = random.randint(3, min(5, len(course_ids)))
        assigned_indices = random.sample(range(len(course_ids)), num_courses)

        for j, ci in enumerate(assigned_indices):
            cid = course_ids[ci]
            if j == 0:
                status = "completed"
            elif j == 1 and random.random() > 0.3:
                status = "completed"
            else:
                status = random.choice(["in_progress", "not_started"])

            score = 0
            if status == "completed":
                score = random.choice([60, 80, 100])

            comp_date = (now - timedelta(days=random.randint(5, 60))).isoformat() if status == "completed" else None

            if random.random() < 0.2:
                deadline = (now - timedelta(days=random.randint(1, 14))).isoformat()
            elif random.random() < 0.3:
                deadline = (now + timedelta(days=random.randint(1, 5))).isoformat()
            else:
                deadline = (now + timedelta(days=random.randint(7, 90))).isoformat()

            assigned_date = (now - timedelta(days=random.randint(1, 30))).isoformat()

            await db.progress.insert_one({
                "user_id": emp_id,
                "course_id": cid,
                "status": status,
                "score": score,
                "completed_at": comp_date,
                "assigned_date": assigned_date,
                "deadline_date": deadline,
                "preferred_lang": emp_lang,
            })
            progress_count += 1

    print(f"{progress_count} progress/assignment records created")

    # ---- Incentives (with new fields) ----
    all_emp_ids_shuffled = list(emp_ids)
    random.shuffle(all_emp_ids_shuffled)

    naps_assigned = [ObjectId(eid) for eid in all_emp_ids_shuffled[0:10]]
    neem_assigned = [ObjectId(eid) for eid in all_emp_ids_shuffled[10:18]]
    pmkvy_assigned = [ObjectId(eid) for eid in all_emp_ids_shuffled[18:30]]

    incentives_data = [
        {
            "scheme_name": "NAPS",
            "description": "Govt. apprenticeship scheme - stipend shared between employer and BOAT for on-the-job training.",
            "benefit": "Saves 25-35% salary cost",
            "benefit_color": "#16A34A",
            "required_count": 2,
            "claimable_amount": 40000,
            "status": "pending",
            "min_employees_required": 10,
            "min_training_duration_months": 3,
            "assigned_employee_ids": naps_assigned,
        },
        {
            "scheme_name": "NEEM",
            "description": "On-the-job skill training via AICTE-approved NEEM facilitators for non-enrolled youth.",
            "benefit": "Cut hiring costs by 40-50%",
            "benefit_color": "#0EA5E9",
            "required_count": 2,
            "claimable_amount": 72000,
            "status": "pending",
            "min_employees_required": 8,
            "min_training_duration_months": 6,
            "assigned_employee_ids": neem_assigned,
        },
        {
            "scheme_name": "PMKVY",
            "description": "MSDE-funded scheme that reimburses training costs for skill certification of workers.",
            "benefit": "Up to Rs. 8,000 reimbursed per trainee",
            "benefit_color": "#7C3AED",
            "required_count": 3,
            "claimable_amount": 108000,
            "status": "pending",
            "min_employees_required": 12,
            "min_training_duration_months": 4,
            "assigned_employee_ids": pmkvy_assigned,
        },
    ]

    for inc in incentives_data:
        await db.incentives.insert_one({
            **inc,
            "company_id": company_id,
            "eligible_count": 0,
        })
    print(f"{len(incentives_data)} incentive schemes created (with assigned employees)")

    # ──────────────────────────────────────────────────────────────
    # NEW EMPLOYEES: Pradeep & Prakash (upsert on email)
    # ──────────────────────────────────────────────────────────────

    # Get NAPS and NEEM scheme ObjectIds for assignment
    naps_scheme = await db.incentives.find_one({"scheme_name": "NAPS"})
    neem_scheme = await db.incentives.find_one({"scheme_name": "NEEM"})

    # --- Employee 1: Pradeep ---
    pradeep_data = {
        "name": "Pradeep",
        "email": "Pradeep@pecpl.com",
        "password": pwd_context.hash("Pradeep@123"),
        "role": "employee",
        "company_id": company_id,
        "job_role": "Machine Operator",
        "department": "Production",
        "primary_language": "en",
        "known_languages": ["en", "ta"],
        "training_start_date": (now - timedelta(days=200)).isoformat(),
        "date_of_joining": (now - timedelta(days=240)).isoformat(),  # ~8 months
    }
    pradeep_result = await db.users.update_one(
        {"email": "Pradeep@pecpl.com"},
        {"$set": pradeep_data},
        upsert=True
    )
    if pradeep_result.upserted_id:
        pradeep_id = str(pradeep_result.upserted_id)
    else:
        p_doc = await db.users.find_one({"email": "Pradeep@pecpl.com"})
        pradeep_id = str(p_doc["_id"])

    # Assign to NAPS
    if naps_scheme:
        await db.incentives.update_one(
            {"_id": naps_scheme["_id"]},
            {"$addToSet": {"assigned_employee_ids": ObjectId(pradeep_id)}}
        )

    # Pradeep: 3 courses (indices 0=Safety, 1=CNC, 2=Manufacturing Layout)
    # Mix: classroom + offline + online. 1 completed, 2 in_progress
    pradeep_courses = [
        {"ci": 0, "status": "completed", "score": 78, "dl_days": 15,
         "comp": (now - timedelta(days=20)).isoformat()},
        {"ci": 1, "status": "in_progress", "score": 0, "dl_days": 35, "comp": None},
        {"ci": 2, "status": "in_progress", "score": 0, "dl_days": 55, "comp": None},
    ]
    for pc in pradeep_courses:
        cid = course_ids[pc["ci"]]
        await db.progress.update_one(
            {"user_id": pradeep_id, "course_id": cid},
            {"$set": {
                "user_id": pradeep_id, "course_id": cid,
                "status": pc["status"], "score": pc["score"],
                "completed_at": pc["comp"],
                "assigned_date": (now - timedelta(days=30)).isoformat(),
                "deadline_date": (now + timedelta(days=pc["dl_days"])).isoformat(),
                "preferred_lang": "en",
            }},
            upsert=True
        )

    # Chatbot conversation entry
    await db.chatbot_conversations.update_one(
        {"user_id": ObjectId(pradeep_id)},
        {"$setOnInsert": {
            "conversation_id": f"pradeep-{pradeep_id[:8]}",
            "user_id": ObjectId(pradeep_id),
            "messages": [],
            "created_at": now, "updated_at": now,
        }},
        upsert=True
    )

    print(f"Employee Pradeep created/updated: Pradeep@pecpl.com / Pradeep@123")

    # --- Employee 2: Prakash Kamaraj ---
    prakash_data = {
        "name": "Prakash Kamaraj",
        "email": "Prakash.kamaraj@sustainworld.in",
        "password": pwd_context.hash("Prakash@123"),
        "role": "employee",
        "company_id": company_id,
        "job_role": "QA Inspector",
        "department": "Quality",
        "primary_language": "ta",
        "known_languages": ["ta", "en"],
        "training_start_date": (now - timedelta(days=380)).isoformat(),
        "date_of_joining": (now - timedelta(days=420)).isoformat(),  # ~14 months
    }
    prakash_result = await db.users.update_one(
        {"email": "Prakash.kamaraj@sustainworld.in"},
        {"$set": prakash_data},
        upsert=True
    )
    if prakash_result.upserted_id:
        prakash_id = str(prakash_result.upserted_id)
    else:
        pk_doc = await db.users.find_one({"email": "Prakash.kamaraj@sustainworld.in"})
        prakash_id = str(pk_doc["_id"])

    # Assign to NEEM
    if neem_scheme:
        await db.incentives.update_one(
            {"_id": neem_scheme["_id"]},
            {"$addToSet": {"assigned_employee_ids": ObjectId(prakash_id)}}
        )

    # Prakash: 4 courses (3=QC ISO, 4=Lean Six Sigma, 5=SPC, 9=Communication)
    # Mix: self-paced + online + classroom + online. 2 completed, 2 in_progress
    prakash_courses = [
        {"ci": 3, "status": "completed", "score": 85, "dl_days": 10,
         "comp": (now - timedelta(days=15)).isoformat()},
        {"ci": 4, "status": "completed", "score": 72, "dl_days": 20,
         "comp": (now - timedelta(days=10)).isoformat()},
        {"ci": 5, "status": "in_progress", "score": 0, "dl_days": 45, "comp": None},
        {"ci": 9, "status": "in_progress", "score": 0, "dl_days": 75, "comp": None},
    ]
    for pk in prakash_courses:
        cid = course_ids[pk["ci"]]
        await db.progress.update_one(
            {"user_id": prakash_id, "course_id": cid},
            {"$set": {
                "user_id": prakash_id, "course_id": cid,
                "status": pk["status"], "score": pk["score"],
                "completed_at": pk["comp"],
                "assigned_date": (now - timedelta(days=40)).isoformat(),
                "deadline_date": (now + timedelta(days=pk["dl_days"])).isoformat(),
                "preferred_lang": "ta",
            }},
            upsert=True
        )

    # Chatbot conversation entry
    await db.chatbot_conversations.update_one(
        {"user_id": ObjectId(prakash_id)},
        {"$setOnInsert": {
            "conversation_id": f"prakash-{prakash_id[:8]}",
            "user_id": ObjectId(prakash_id),
            "messages": [],
            "created_at": now, "updated_at": now,
        }},
        upsert=True
    )

    print(f"Employee Prakash created/updated: Prakash.kamaraj@sustainworld.in / Prakash@123")

    # ──────────────────────────────────────────────────────────────
    # INDEXES for all collections
    # ──────────────────────────────────────────────────────────────
    await db.users.create_index("email", unique=True)
    await db.progress.create_index([("user_id", 1), ("course_id", 1)], unique=True)
    await db.chatbot_conversations.create_index("conversation_id", unique=True, background=True)
    await db.chatbot_conversations.create_index("user_id", background=True)
    await db.chatbot_conversations.create_index([("updated_at", -1)], background=True)
    # Rate limits
    await db.chatbot_rate_limits.create_index("user_id", unique=True, background=True)
    # AI TTL indexes
    await db.ai_recommendations.create_index("user_id", unique=True, background=True)
    await db.ai_recommendations.create_index("expires_at", expireAfterSeconds=0, background=True)
    await db.ai_insights.create_index("user_id", unique=True, background=True)
    await db.ai_insights.create_index("expires_at", expireAfterSeconds=0, background=True)
    await db.ai_summaries.create_index("cache_key", unique=True, background=True)
    await db.ai_summaries.create_index("expires_at", expireAfterSeconds=0, background=True)

    # ──────────────────────────────────────────────────────────────
    # PRE-POPULATE AI RECOMMENDATIONS (static seed, no Gemini call)
    # ──────────────────────────────────────────────────────────────

    # For Pradeep: recommend courses he's NOT assigned to
    pradeep_recs = [
        {"course_id": course_ids[3], "title": "Quality Control (ISO 9001)",
         "reason": "Cross-functional quality knowledge benefits Production operators.",
         "training_mode": "self-paced"},
        {"course_id": course_ids[6], "title": "Preventive Maintenance Essentials",
         "reason": "Understanding equipment maintenance reduces downtime on the production floor.",
         "training_mode": "offline"},
        {"course_id": course_ids[10], "title": "Fire Safety & Extinguisher Use",
         "reason": "Mandatory safety training important for all production personnel.",
         "training_mode": "offline"},
    ]
    await db.ai_recommendations.update_one(
        {"user_id": pradeep_id},
        {"$set": {
            "user_id": pradeep_id,
            "recommendations": pradeep_recs,
            "cached_at": now,
            "expires_at": now + timedelta(hours=24),
        }},
        upsert=True
    )

    # For Prakash: recommend courses he's NOT assigned to
    prakash_recs = [
        {"course_id": course_ids[0], "title": "Industrial Safety Fundamentals",
         "reason": "Safety training complements quality inspection skills for shop floor work.",
         "training_mode": "classroom"},
        {"course_id": course_ids[8], "title": "PLC Programming Basics",
         "reason": "Automation understanding enhances quality monitoring capabilities.",
         "training_mode": "self-paced"},
        {"course_id": course_ids[11], "title": "Compliance & Labor Law Awareness",
         "reason": "Regulatory knowledge is essential for quality compliance audits.",
         "training_mode": "self-paced"},
    ]
    await db.ai_recommendations.update_one(
        {"user_id": prakash_id},
        {"$set": {
            "user_id": prakash_id,
            "recommendations": prakash_recs,
            "cached_at": now,
            "expires_at": now + timedelta(hours=24),
        }},
        upsert=True
    )

    print("AI recommendations pre-populated for Pradeep & Prakash")

    print("\nSeed complete! Login credentials:")
    print("   Admin:       admin@skillsync.com / admin123")
    print("   Employee:    <firstname><lastname>@skillsync.com / emp123")
    print("   Pradeep:     Pradeep@pecpl.com / Pradeep@123")
    print("   Prakash:     Prakash.kamaraj@sustainworld.in / Prakash@123")
    print("\n--- NEW COURSES ADDED ---")
    print(f"Chemical Safety Training ID: {course_ids[-2]}")
    print(f"Heat Stress Training ID: {course_ids[-1]}")
    print("-------------------------\n")

    client.close()



if __name__ == "__main__":
    asyncio.run(seed())
