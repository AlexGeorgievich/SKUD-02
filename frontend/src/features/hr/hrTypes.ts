export type HrEmployee={
 id:string;plan_name:string;plan_department:string;family_name?:string|null;given_name?:string|null;patronymic?:string|null;
 office?:string|null;office_id?:string|null;department?:string|null;department_id?:string|null;legal_entity_id?:string|null;gender_id?:string|null;work_format_id?:string|null;position_id?:string|null;
 department_status?:string|null;gender?:string|null;birth_year?:number|null;birth_month?:string|null;birth_date?:string|null;birth_place?:string|null;
 education_institution?:string|null;education_specialty?:string|null;education_graduation_year?:number|null;education_graduation_month?:string|null;education_graduation_date?:string|null;work_experience?:string|null;
 position?:string|null;position_en?:string|null;hire_date?:string|null;work_schedule?:string|null;schedule_type?:string|null;department_head_id?:string|null;deputy_id?:string|null;deputy_from?:string|null;deputy_until?:string|null;
 employment_status?:string|null;employment_type?:string|null;probation_end_date?:string|null;comments?:string|null;responsibility?:string|null;personnel_number?:string|null;
 work_email?:string|null;work_phone?:string|null;telegram?:string|null;personal_phone?:string|null;business_card?:string|null;academic_degree?:string|null;recommendation?:string|null;recruiter?:string|null;photo_source_url?:string|null;mail_image_url?:string|null;insurance?:string|null;
 access_card_number?:string|null;access_card_status?:string|null;access_level?:string|null;photo_url?:string|null;archived_at?:string|null;archived_by?:string|null;
};
export type HrCatalogItem={id:string;name?:string;label?:string;kind?:string;office_id?:string|null;head_id?:string|null};
export type HrCatalogsData={offices:HrCatalogItem[];departments:HrCatalogItem[];legal_entities:HrCatalogItem[];positions:HrCatalogItem[];values:HrCatalogItem[]};
export const EMPTY_CATALOGS:HrCatalogsData={offices:[],departments:[],legal_entities:[],positions:[],values:[]};
