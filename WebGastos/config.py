#SECRET_KEY=your_secret_key_here
#DATABASE_URL=sqlite:///site.db  

import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "default-secret")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///site.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
