import os
import sys

# Add parent dir to sys.path to run tests locally
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.feedback_service import feedback_service
from database import SessionLocal

items = feedback_service.get_feedback_list()
print("Stats:", feedback_service.get_feedback_stats())
print("Items:", items)
print("Items length:", len(items))
