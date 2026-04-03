@echo off
title IndiaBiz Analytics v5.0 Enhanced — Dark Theme Setup
color 0A

echo ============================================================
echo   INDIABIZ ANALYTICS v5.1 — BUG FIXES + ENHANCEMENTS
echo   State KPI Fix + Product Map Panel + Cream Demo Data
echo ============================================================
echo.
echo  FIXES:
echo    - Map state click now loads KPIs correctly
echo    - Statewise drill-through button fixed
echo    - Cream product seeded across all 33 states
echo    - Product map side panel: highest/lowest revenue states
echo.
echo  15 DEMO USERS (password: Demo@123):
echo    arjun_mumbai    priya_delhi     ravi_bangalore  meera_chennai
echo    vikram_kolkata  anita_hyderabad suresh_pune     kavitha_jaipur
echo    rohit_ahmedabad lakshmi_lucknow deepak_chandigarh sunita_bhopal
echo    arun_kochi      pooja_nagpur    nitin_guwahati
echo.
echo  ADMIN: admin / Admin@123
echo ============================================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Install Python 3.8+ from https://python.org
    pause
    exit /b 1
)
echo [1/5] Python found.

echo [2/5] Installing packages...
pip install flask flask-cors pyjwt --quiet
echo       Packages ready.

if not exist "uploads" mkdir uploads
echo [3/5] Uploads directory ready.

echo [4/5] Setting up database (15 demo records auto-seeded)...
if not exist "sales_forecasting.db" (
    python create_database.py
) else (
    echo       Existing DB found. Missing demo records will be added.
)

echo [5/5] Starting server...
echo.
echo   URL: http://localhost:5000
echo   ADMIN: admin / Admin@123    DEMO: arjun_mumbai / Demo@123
echo   Press Ctrl+C to stop
echo.

start "" http://localhost:5000
python app.py
pause
