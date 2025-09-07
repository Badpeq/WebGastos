from flask import Blueprint, render_template, redirect, url_for, flash, request, session
from werkzeug.security import check_password_hash
from app.extensions import db
from app.models import User

auth_bp = Blueprint('auth_bp', __name__)


@auth_bp.route('/')
def home():
    return redirect(url_for('auth_bp.login'))


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']

        user = User.query.filter_by(email=email).first()

        if user and check_password_hash(user.password_hash, password):
            session['user_id'] = user.id
            flash('Inicio de sesión exitoso', 'success')
            return redirect(url_for('dashboard_bp.dashboard'))
        else:
            flash('Correo o contraseña inválidos', 'danger')

    return render_template('auth/login.html')


@auth_bp.route('/logout')
def logout():
    session.pop('user_id', None)
    flash('Sesión cerrada correctamente', 'info')
    return redirect(url_for('auth_bp.login'))
