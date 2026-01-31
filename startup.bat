@echo off
echo Installing dependencies and starting both servers...

start cmd /k "cd /d "C:\FYP_Virtual_lab" && npm install && npm start"
start cmd /k "cd /d "C:\FA-Website-and-AI-main" && npm install && npm start"