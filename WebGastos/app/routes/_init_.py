from flask import Blueprint

# Registrar cada blueprint individual aquí
def register_blueprints(app):
    from .auth import auth_bp
    from .dashboard import dashboard_bp
    from .budget import budgets_bp
    from .expenses import expenses_bp
    from .recurring import recurring_bp
    from .installments import installments_bp
    from .logs import logs_bp
    from .reports import reports_bp
    from .shared import shared_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(budgets_bp)
    app.register_blueprint(expenses_bp)
    app.register_blueprint(recurring_bp)
    app.register_blueprint(installments_bp)
    app.register_blueprint(logs_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(shared_bp)
