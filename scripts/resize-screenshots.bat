@echo off
echo Chrome Web Store Screenshot Resizer
echo =====================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python from https://python.org
    pause
    exit /b 1
)

REM Check if Pillow is installed, install if needed
python -c "import PIL" >nul 2>&1
if errorlevel 1 (
    echo Installing Pillow library...
    pip install Pillow
    if errorlevel 1 (
        echo Error: Failed to install Pillow
        echo Please run: pip install Pillow
        pause
        exit /b 1
    )
)

REM Run the resize script
echo Running screenshot resizer...
echo.
python resize-screenshots.py %*

if errorlevel 1 (
    echo.
    echo Script completed with errors
) else (
    echo.
    echo Script completed successfully!
    echo Check the 'listing/assets/resized' folder for results
)

echo.
pause