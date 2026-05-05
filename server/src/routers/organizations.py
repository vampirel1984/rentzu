from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db import get_db
from dependencies import CurrentUser, get_current_user
from schemas.organization import OrganizationCreate, OrganizationPatch, OrganizationRead
from services.organizations import (
    create_organization,
    get_organization_for_user,
    list_organizations_for_user,
    patch_organization,
)

router = APIRouter()


@router.get('', response_model=list[OrganizationRead])
def organizations_index(
    user_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return list_organizations_for_user(db, user_id)


@router.post('', response_model=OrganizationRead)
def organizations_create(
    payload: OrganizationCreate,
    user_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return create_organization(db, user_id=user_id, name=payload.name, entity_type=payload.entity_type)


@router.patch('/{organization_id}', response_model=OrganizationRead)
def organizations_patch(
    organization_id: UUID,
    payload: OrganizationPatch,
    user_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    current_user.require_org_access(organization_id)
    organization = get_organization_for_user(db, organization_id, user_id)
    if not organization:
        raise HTTPException(status_code=404, detail='Organization not found')
    return patch_organization(db, organization, name=payload.name, entity_type=payload.entity_type)
