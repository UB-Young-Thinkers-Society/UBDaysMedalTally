from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import mysql.connector
import os

# --- Database Configuration ---
db_config = {
    "host": "localhost",
    "user": "",      
    "password": "",  
    "database": "tabulation_db"
}

# --- FastAPI Application Setup ---
app = FastAPI()

# Absolute path of the directory where this script is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

# To Mount the 'static' directory to serve CSS, JS, and image files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Pydantic Data Models
class Event(BaseModel):
    id: int
    name: str
    medal_count: int
    status: str

class EventCreate(BaseModel):
    name: str
    medal_count: int
    status: str

# --- Database Connection ---
def get_db_connection():
    try:
        conn = mysql.connector.connect(**db_config)
        return conn
    except mysql.connector.Error as err:
        print(f"Error: {err}")
        return None

# --- API Endpoints for CRUD Operations ---

@app.post("/api/events", response_model=Event)
async def create_event(event: EventCreate):
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = conn.cursor(dictionary=True)
    query = "INSERT INTO events (name, medal_count, status) VALUES (%s, %s, %s)"
    cursor.execute(query, (event.name, event.medal_count, event.status))
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return {"id": new_id, **event.dict()}

@app.get("/api/events", response_model=list[Event])
async def get_events():
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM events")
    events = cursor.fetchall()
    cursor.close()
    conn.close()
    return events

@app.put("/api/events/{event_id}", response_model=Event)
async def update_event(event_id: int, event: EventCreate):
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = conn.cursor(dictionary=True)
    query = "UPDATE events SET name = %s, medal_count = %s, status = %s WHERE id = %s"
    cursor.execute(query, (event.name, event.medal_count, event.status, event_id))
    conn.commit()
    cursor.close()
    conn.close()
    return {"id": event_id, **event.dict()}

@app.delete("/api/events/{event_id}")
async def delete_event(event_id: int):
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = conn.cursor()
    query = "DELETE FROM events WHERE id = %s"
    cursor.execute(query, (event_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return {"message": "Event deleted successfully"}

# --- HTML Page Serving ---

@app.get("/")
async def get_login_page():
    return FileResponse(os.path.join(TEMPLATES_DIR, "login.html"))

@app.get("/tabulation-head")
async def get_tabulation_page():
    return FileResponse(os.path.join(TEMPLATES_DIR, "tabulation-head.html"))