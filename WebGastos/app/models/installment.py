from app.extensions import db
from datetime import date

class Installment(db.Model):
    __tablename__ = 'installments'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    budget_id = db.Column(db.Integer, db.ForeignKey('budgets.id'), nullable=True)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)

    description = db.Column(db.String(255), nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    start_date = db.Column(db.Date, default=date.today)
    end_date = db.Column(db.Date)
    number_of_installments = db.Column(db.Integer)
    installment_amount = db.Column(db.Float)
    is_paid = db.Column(db.Boolean, default=False)

    user = db.relationship('User', backref='installments')
    budget = db.relationship('Budget', backref='installments')
    category = db.relationship('Category', backref='installments')

    def __repr__(self):
        return f"<Installment {self.description}: {self.number_of_installments} cuotas>"
