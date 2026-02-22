@echo off
echo Starting Aether Eye Server...

:: Check if a virtual environment named "venv" exists and activate it
if exist "venv\Scripts\activate.bat" (
    echo Activating Virtual Environment...
    call "venv\Scripts\activate.bat"
) else (
    echo No virtual environment found. Running globally.
)

:: Run the server
echo Running Uvicorn Setup...
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

:: Wait for user input to close the window if the server stops
pause
