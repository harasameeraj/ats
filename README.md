# Stitch ATS

## Prerequisites
- Node.js (v18+)
- Python (v3.10+)

## Quick Start (For Managers/Reviewers)

If you received this project as a zip file, follow the appropriate steps below for your operating system.

### Windows Users (Recommended)
1. Double-click the `run_windows.bat` file in the root folder.
2. The script will automatically create a virtual environment, install all dependencies (bypassing corporate SSL issues), and start both the backend and frontend servers.
3. Wait for the two new command prompt windows to finish starting up.
4. The frontend will be available at `http://localhost:5173`.
5. The backend will be available at `http://localhost:8000`.

### Mac/Linux Users
1. Open a terminal in the **root** folder and run the backend:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

2. Open a **second** terminal in the **root** folder and run the frontend:
```bash
cd frontend
npm install
npm run dev
```

## Troubleshooting
- **Frontend Vite Errors**: Delete the `frontend/node_modules` directory and run `npm install` again.
- **SSL Certificate Errors during pip install**: Run `pip install` with `--trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host pypi.python.org`.
