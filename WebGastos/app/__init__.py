from flask import Flask, session
from app.extensions import db, migrate, login_manager
from app.models import *  # Importa todos los modelos necesarios

def create_app():
    app = Flask(__name__)

    # Configuración general
    app.config.from_object('config.Config')

    # Inicialización de extensiones
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)

    login_manager.login_view = 'auth.login'

    from app.models import User

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    @app.context_processor
    def inject_usuario():
        """Inyecta 'usuario' en todos los templates para el layout shell."""
        user_id = session.get('user_id')
        if user_id:
            return {'usuario': User.query.get(user_id)}
        return {'usuario': None}


    # Importación y registro de Blueprints
    from app.routes.auth import auth_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.budget import budgets_bp
    from app.routes.expenses import expenses_bp
    from app.routes.shared import shared_bp
    from app.routes.logs import logs_bp
    from app.routes.recurring import recurring_bp
    from app.routes.installments import installment_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(budgets_bp)
    app.register_blueprint(expenses_bp)
    app.register_blueprint(shared_bp)
    app.register_blueprint(logs_bp)
    app.register_blueprint(recurring_bp)
    app.register_blueprint(installment_bp)

    return app