import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import DATABASE_URL

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class HCPInteraction(Base):
    __tablename__ = "hcp_interactions"

    id = Column(Integer, primary_key=True, index=True)
    hcp_name = Column(String(255), index=True, nullable=True)
    interaction_type = Column(String(50), default="Meeting")
    date = Column(String(50), nullable=True)
    time = Column(String(50), nullable=True)
    attendees = Column(String(555), nullable=True)
    topics_discussed = Column(Text, nullable=True)
    materials_shared = Column(String(555), nullable=True)
    sentiment = Column(String(50), default="Neutral")
    samples_distributed = Column(String(555), nullable=True)
    outcomes = Column(Text, nullable=True)
    followup_actions = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class FollowUpTask(Base):
    __tablename__ = "followup_tasks"

    id = Column(Integer, primary_key=True, index=True)
    hcp_name = Column(String(255), index=True)
    task_description = Column(Text)
    due_date = Column(String(50))
    status = Column(String(50), default="Pending")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)
