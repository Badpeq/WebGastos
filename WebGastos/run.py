from app import create_app
from app.extensions import db, migrate
from flask_migrate import upgrade

app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
