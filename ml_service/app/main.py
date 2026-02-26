from fastapi import FastAPI

app = FastAPI(title="HQBMS ML Service", version="1.0.0")

@app.get("/health")
def health_check():
    return {"status": "healthy", "models_loaded": False, "ollama_status": "unknown"}

@app.post("/predict/waittime")
def predict_wait_time():
    # To be implemented
    return {"estimate_minutes": 0, "ml_component": 0, "ma_component": 0}

@app.post("/rag/query")
def rag_query():
    # To be implemented
    return {"answer": "", "sources": [], "confidence": 0}

@app.post("/rag/ingest")
def rag_ingest():
    # To be implemented
    return {"status": "success", "chunks_added": 0, "doc_id": ""}
