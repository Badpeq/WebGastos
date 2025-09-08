from app.extensions import db
from datetime import datetime

class Log(db.Model):
    __tablename__ = 'logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    action = db.Column(db.String(255), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    metad_info = db.Column(db.Text)  # JSON string o información adicional

    user = db.relationship('User', backref='logs')

    def __repr__(self):
        return f"<Log {self.action} by User {self.user_id} at {self.timestamp}>"
