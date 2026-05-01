from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import connect_db, close_db
from routes.auth_routes import router as auth_router
from routes.admin_routes import router as admin_router
from routes.employee_routes import router as employee_router
from routes.course_routes import router as course_router
from routes.assessment_routes import router as assessment_router
from routes.scheme_routes import router as scheme_router
from routes.assignment_routes import router as assignment_router
from routes.translate_routes import router as translate_router
from routers.chatbot import router as chatbot_router
from routers.ai_routes import router as ai_router
from routers.materials_routes import router as materials_router
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="SkillSync V2 API",
    description="Manufacturing Training Management Platform",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — must be added BEFORE routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(employee_router)
app.include_router(course_router)
app.include_router(assessment_router)
app.include_router(scheme_router)
app.include_router(assignment_router)
app.include_router(translate_router)
app.include_router(chatbot_router)
app.include_router(ai_router)
app.include_router(materials_router)

@app.get("/")
async def root():
    return {"message": "SkillSync API is running", "version": "2.0.0"}

@app.get("/seed")
def run_seed():
    from seed import seed
    asyncio.run(seed())
    return {"message": "Database seeded successfully"}