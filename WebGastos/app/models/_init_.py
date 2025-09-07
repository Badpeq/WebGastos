from app.extensions import db

# Modelos principales
from .user import User
from .budget import Presupuesto
from .shared import Categoria
from .expense import Gasto

# Modelos adicionales
from .logs import Log
from .recurring import RecurringExpense
from .installment import Installment
