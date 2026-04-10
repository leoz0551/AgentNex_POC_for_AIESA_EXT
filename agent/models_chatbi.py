from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

Base = declarative_base()

class UserInfo(Base):
    __tablename__ = 'user_info'
    username = Column(String, primary_key=True, index=True)
    group_name = Column(String)  # l1
    org_name = Column(String)    # l2
    dept_name = Column(String)   # l3
    team_name = Column(String)   # l4
    
    queries = relationship("UserQuery", back_populates="user")

class UserQuery(Base):
    __tablename__ = 'user_query'
    query_id = Column(String, primary_key=True, index=True)
    session_id = Column(String, index=True)
    username = Column(String, ForeignKey('user_info.username'))
    response_id = Column(String)
    q_time = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("UserInfo", back_populates="queries")
    content = relationship("QueryContent", back_populates="query", uselist=False)

class QueryContent(Base):
    __tablename__ = 'query_content'
    query_id = Column(String, ForeignKey('user_query.query_id'), primary_key=True)
    response_id = Column(String)
    user_query = Column(String)
    ai_response = Column(String)
    
    query = relationship("UserQuery", back_populates="content")

# Database initialization
DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'chatbi.db')
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
engine = create_engine(f'sqlite:///{DB_PATH}', connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
