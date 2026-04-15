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
import asyncio

@app.get("/seed")
def run_seed():
    from seed import seed
    asyncio.run(seed())
    return {"message": "Database seeded successfully"}

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


@app.get("/")
async def root():
    return {"message": "SkillSync API is running", "version": "1.0.0"}
