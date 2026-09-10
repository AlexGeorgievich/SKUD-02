"""Initial safe HR personnel schema."""
from backend.app.hr.models import Base
from alembic import op
revision = "0001_hr_initial"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    Base.metadata.create_all(op.get_bind())

def downgrade():
    Base.metadata.drop_all(op.get_bind())
