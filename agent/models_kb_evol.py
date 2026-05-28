import os
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from config import DATA_DIR

# Ensure the data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

# Set up the SQLAlchemy engine for the decoupled database
db_path = os.path.join(DATA_DIR, "kb_evol.db")
engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class KBEvolTask(Base):
    """
    Core Task table for Knowledge Base Evolution tracking.
    This tracks the multi-agent pipeline progress for a specific conversation failure.
    """
    __tablename__ = "kb_evol_tasks"
    
    id = Column(String, primary_key=True, index=True) # e.g. "task-102"
    title = Column(String, default="Imported Log Evolution - Pending")
    desc = Column(String, default="Manually submitted task record waiting for evaluation and generation.")
    status = Column(String, default="Step 1: Pending")
    transcript = Column(Text, nullable=False)
    gap_cause = Column(String, nullable=True)
    gap_desc = Column(Text, nullable=True)
    retrieved_info = Column(Text, nullable=True)
    source = Column(String, nullable=True)
    markdown = Column(Text, nullable=True)
    progress = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    logs = relationship("AgentLog", back_populates="task", cascade="all, delete-orphan")

class AgentLog(Base):
    """
    Audit log table for each Agent's invocation.
    Stores the inputs, outputs, and routing paths of each step in the pipeline.
    """
    __tablename__ = "agent_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String, ForeignKey("kb_evol_tasks.id"))
    agent_name = Column(String, nullable=False)
    input_data = Column(Text, nullable=True)
    output_data = Column(Text, nullable=True)
    storage_method = Column(String, default="SQLite data/kb_evol.db")
    route_status = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    
    task = relationship("KBEvolTask", back_populates="logs")

# Create tables if they do not exist
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
