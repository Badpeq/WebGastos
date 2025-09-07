from app.extensions import db
from datetime import date

class RecurringExpense(db.Model):
    __tablename__ = 'recurring_expenses'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    budget_id = db.Column(db.Integer, db.ForeignKey('budgets.id'), nullable=True)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)

    description = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    frequency = db.Column(db.String(20), nullable=False)  # monthly, yearly
    start_date = db.Column(db.Date, default=date.today)
    next_due_date = db.Column(db.Date)

    is_active = db.Column(db.Boolean, default=True)

    user = db.relationship('User', backref='recurring_expenses')
    budget = db.relationship('Budget', backref='recurring_expenses')
    category = db.relationship('Category', backref='recurring_expenses')

    def __repr__(self):
        return f"<RecurringExpense {self.description} every {self.frequency}>"
