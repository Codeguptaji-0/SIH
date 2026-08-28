from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.models import User, QuizAttempt, CompetencyResult, Competency, LearningPath
from app.schemas.schemas import AdminAnalyticsResponse
from app.auth.dependencies import require_role

router = APIRouter(prefix="/api/admin", tags=["Admin Analytics"])

@router.get("/analytics", response_model=AdminAnalyticsResponse)
def get_admin_analytics(
    db: Session = Depends(get_db),
    user=Depends(require_role("ADMIN"))
):
    # Every figure below is a real query result. The previous version substituted
    # invented baselines (248 officials, 182 assessments, 71.4 average, 37 gaps) when
    # a count came back zero, so an empty or disconnected database rendered as a busy
    # one. A judge stopping the backend saw confident numbers that described nothing.
    total_officials = db.query(User).filter(User.role == "OFFICIAL").count()
    assessments_completed = db.query(QuizAttempt).count()
    avg_score = db.query(func.avg(QuizAttempt.overall_score)).scalar() or 0.0
    critical_gaps_count = (
        db.query(CompetencyResult).filter(CompetencyResult.status == "critical_gap").count()
    )

    # 1. domain_readiness aggregation query: GROUP BY domain on CompetencyResult
    domain_query = db.query(
        Competency.domain,
        func.avg(CompetencyResult.score).label("avg_score")
    ).join(Competency, CompetencyResult.competency_id == Competency.id)\
     .group_by(Competency.domain).all()

    # Empty dict when there is no assessment data yet, so the dashboard can show an
    # honest "no assessments recorded" state instead of four invented readiness bars.
    domain_readiness = {
        row.domain: round(float(row.avg_score), 1)
        for row in domain_query
        if row.avg_score is not None
    }

    # 2. top_gaps aggregation query: CompetencyResult where status = 'critical_gap'
    top_gaps_query = db.query(
        Competency.name.label("competency"),
        func.count(CompetencyResult.id).label("officials_affected"),
        func.avg(CompetencyResult.score).label("avg_score")
    ).join(Competency, CompetencyResult.competency_id == Competency.id)\
     .filter(CompetencyResult.status == "critical_gap")\
     .group_by(Competency.name)\
     .order_by(func.count(CompetencyResult.id).desc())\
     .limit(4).all()

    # Real rows only, and no invented 50.0 stand-in for a missing average.
    top_gaps = [
        {
            "competency": row.competency,
            "gap_percentage": round(100.0 - float(row.avg_score), 1),
            "officials_affected": row.officials_affected
        }
        for row in top_gaps_query
        if row.avg_score is not None
    ]

    # 3. training_demand aggregation query: count enrolled officials per course in LearningPath
    demand_query = db.query(
        LearningPath.course_title,
        LearningPath.provider,
        func.count(LearningPath.user_id).label("enrolled_officials")
    ).group_by(LearningPath.course_title, LearningPath.provider)\
     .order_by(func.count(LearningPath.user_id).desc())\
     .limit(4).all()

    training_demand = [
        {
            "course_title": row.course_title,
            "enrolled_officials": row.enrolled_officials,
            "provider": row.provider
        }
        for row in demand_query
    ]

    # 4. Period-over-period trend: last 7 days vs the 7 days before that.
    #
    # Deliberately NOT called predictive. This is a comparison of two past windows; it
    # forecasts nothing. Timestamps are naive UTC to match how completed_at is stored.
    now = datetime.utcnow()
    last_7_days = now - timedelta(days=7)
    prev_14_days = now - timedelta(days=14)

    recent_avg = db.query(func.avg(QuizAttempt.overall_score))\
                   .filter(QuizAttempt.completed_at >= last_7_days).scalar()
    prev_avg = db.query(func.avg(QuizAttempt.overall_score))\
                 .filter(QuizAttempt.completed_at >= prev_14_days, QuizAttempt.completed_at < last_7_days).scalar()

    domain_trends = {}
    for domain_name in domain_readiness.keys():
        if recent_avg is not None and prev_avg is not None and prev_avg > 0:
            diff = ((recent_avg - prev_avg) / prev_avg) * 100
            if diff > 1.5:
                trend_status = "trending_up"
            elif diff < -1.5:
                trend_status = "trending_down"
            else:
                trend_status = "stable"
        else:
            # Not enough history in both windows to compare. Say so rather than
            # guessing "trending_up" from the domain's name.
            trend_status = "insufficient_data"

        domain_trends[domain_name] = trend_status

    return AdminAnalyticsResponse(
        total_officials=total_officials,
        assessments_completed=assessments_completed,
        average_competency=round(float(avg_score), 1),
        critical_gaps_count=critical_gaps_count,
        domain_readiness=domain_readiness,
        domain_trends=domain_trends,
        top_gaps=top_gaps,
        training_demand=training_demand
    )

