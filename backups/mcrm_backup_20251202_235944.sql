--
-- PostgreSQL database dump
--

\restrict p39y2PtfIIvIOChCR0NXjbrP4ERgKYcqnFh25Ie7SQxq0E5MxRFCZy7mtNB0BHX

-- Dumped from database version 16.10 (0374078)
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_log (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id character varying NOT NULL,
    action text NOT NULL,
    description text NOT NULL,
    user_id character varying,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id character varying NOT NULL,
    file_name text NOT NULL,
    file_type text NOT NULL,
    file_size integer NOT NULL,
    object_path text NOT NULL,
    uploaded_by character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    contact_person text,
    designation text,
    email text,
    phone text,
    alternate_phone text,
    website text,
    industry text,
    company text,
    gst_number text,
    pan_number text,
    address text,
    city text,
    state text,
    country text,
    pincode text,
    status text DEFAULT 'active'::text NOT NULL,
    customer_type text DEFAULT 'prospect'::text,
    selected_modules text[],
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: demo_date_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demo_date_history (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    lead_id character varying NOT NULL,
    demo_date timestamp without time zone NOT NULL,
    changed_by_id character varying,
    change_reason text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    manager_id character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: escalation_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escalation_history (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    ticket_id character varying NOT NULL,
    from_level integer NOT NULL,
    to_level integer NOT NULL,
    reason text,
    escalated_by character varying,
    escalated_at timestamp without time zone DEFAULT now()
);


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    ticket_id character varying NOT NULL,
    rating integer,
    comments text,
    satisfied boolean,
    submitted_at timestamp without time zone DEFAULT now()
);


--
-- Name: follow_ups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follow_ups (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    lead_id character varying NOT NULL,
    notes text NOT NULL,
    follow_up_date timestamp without time zone NOT NULL,
    completed boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: knowledge_base_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base_chunks (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    source_id character varying NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    language_code character varying(10) DEFAULT 'en'::character varying NOT NULL,
    token_count integer,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now(),
    embedding public.vector(1536)
);


--
-- Name: knowledge_base_queries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base_queries (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying,
    query_text text NOT NULL,
    language_code character varying(10) DEFAULT 'en'::character varying,
    include_cross_language boolean DEFAULT false,
    results_count integer,
    top_results jsonb,
    search_duration_ms integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: knowledge_base_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base_sources (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    category character varying(100) DEFAULT 'general'::character varying NOT NULL,
    content_type character varying(50) DEFAULT 'document'::character varying NOT NULL,
    original_content text NOT NULL,
    language_code character varying(10) DEFAULT 'en'::character varying NOT NULL,
    translation_group_id character varying,
    translation_status character varying(20) DEFAULT 'original'::character varying,
    source_url text,
    file_url text,
    file_name text,
    file_size integer,
    is_indexed boolean DEFAULT false,
    indexed_at timestamp without time zone,
    token_count integer,
    chunk_count integer,
    created_by character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    customer_id character varying,
    company_name text NOT NULL,
    contact_person text NOT NULL,
    contact_email text NOT NULL,
    contact_phone text,
    lead_source text NOT NULL,
    estimated_value integer,
    stage text DEFAULT 'new_lead'::text NOT NULL,
    sales_executive_id character varying,
    demo_date timestamp without time zone,
    quote_sent_date timestamp without time zone,
    quote_value integer,
    selected_modules text[],
    negotiation_date timestamp without time zone,
    closed_date timestamp without time zone,
    confirmed_order_value integer,
    closed_reason text,
    days_in_stage integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: negotiation_date_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.negotiation_date_history (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    lead_id character varying NOT NULL,
    negotiation_date timestamp without time zone NOT NULL,
    notes text,
    changed_by_id character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: otp_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_verifications (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email character varying NOT NULL,
    otp_code character varying(6) NOT NULL,
    purpose character varying(20) DEFAULT 'signup'::character varying NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    is_used boolean DEFAULT false,
    attempts integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: planning_change_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planning_change_logs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_module_id character varying NOT NULL,
    project_id character varying NOT NULL,
    changed_by character varying,
    change_type text NOT NULL,
    field_name text NOT NULL,
    old_value text,
    new_value text,
    old_engineer_id character varying,
    new_engineer_id character varying,
    reason text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: point_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_categories (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    module_type character varying(20) NOT NULL,
    base_points integer DEFAULT 1 NOT NULL,
    reassign_penalty integer DEFAULT 1 NOT NULL,
    completion_bonus integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    department_id character varying
);


--
-- Name: point_category_department_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_category_department_settings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    point_category_id character varying NOT NULL,
    department character varying(50) NOT NULL,
    base_points integer NOT NULL,
    reassign_penalty integer NOT NULL,
    completion_bonus integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: project_engineers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_engineers (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_id character varying NOT NULL,
    engineer_id character varying NOT NULL,
    assigned_at timestamp without time zone DEFAULT now()
);


--
-- Name: project_handoffs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_handoffs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_id character varying NOT NULL,
    completion_certificate_issued boolean DEFAULT false,
    completion_certificate_date timestamp without time zone,
    training_certificate_issued boolean DEFAULT false,
    training_certificate_date timestamp without time zone,
    handoff_date timestamp without time zone,
    handoff_to_team text DEFAULT 'support'::text,
    handoff_by_id character varying,
    notes text,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: project_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_modules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_id character varying NOT NULL,
    module_id character varying NOT NULL,
    assigned_engineer_id character varying,
    scheduled_start_date timestamp without time zone,
    scheduled_end_date timestamp without time zone,
    department_name text,
    department_contact text,
    installation_status text DEFAULT 'pending'::text,
    installation_notes text,
    actual_engineer_id character varying,
    actual_visit_date timestamp without time zone,
    completed boolean DEFAULT false,
    completed_at timestamp without time zone
);


--
-- Name: project_progress_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_progress_entries (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_id character varying NOT NULL,
    engineer_id character varying,
    progress_date timestamp without time zone NOT NULL,
    progress_type text DEFAULT 'installation'::text,
    description text NOT NULL,
    attachments jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    customer_id character varying,
    lead_id character varying,
    client_name text NOT NULL,
    implementation_date timestamp without time zone,
    status text DEFAULT 'not_started'::text NOT NULL,
    completion_percentage integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    lead_id character varying NOT NULL,
    amount integer NOT NULL,
    description text,
    status text DEFAULT 'pending'::text NOT NULL,
    valid_until timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: role_change_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_change_history (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    previous_role_id character varying,
    new_role_id character varying,
    changed_by character varying NOT NULL,
    reason text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


--
-- Name: system_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_modules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    description text,
    icon text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value text,
    setting_type character varying(20) DEFAULT 'string'::character varying NOT NULL,
    category character varying(50) DEFAULT 'general'::character varying NOT NULL,
    description text,
    is_secret boolean DEFAULT false,
    updated_by character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_comments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    task_id character varying NOT NULL,
    user_id character varying NOT NULL,
    content text NOT NULL,
    voice_note_url text,
    voice_note_duration integer,
    mentioned_users text[],
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: task_followups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_followups (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    task_id character varying NOT NULL,
    user_id character varying NOT NULL,
    followup_type text DEFAULT 'text'::text NOT NULL,
    description text,
    voice_note_url text,
    voice_note_duration integer,
    video_url text,
    video_duration integer,
    video_thumbnail_url text,
    image_url text,
    next_followup_date timestamp without time zone,
    status text DEFAULT 'completed'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'medium'::text,
    created_by character varying NOT NULL,
    assigned_to character varying,
    assigned_at timestamp without time zone,
    mentioned_users text[],
    reminder_date timestamp without time zone,
    due_date timestamp without time zone,
    voice_note_url text,
    voice_note_duration integer,
    attachments jsonb,
    related_entity_type text,
    related_entity_id character varying,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: ticket_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_comments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    ticket_id character varying NOT NULL,
    user_id character varying,
    comment text NOT NULL,
    is_internal boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    ticket_number text NOT NULL,
    customer_id character varying,
    project_id character varying,
    module_id character varying,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text,
    issue_summary text NOT NULL,
    issue_description text NOT NULL,
    attachments text[],
    priority text DEFAULT 'medium'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    assigned_engineer_id character varying,
    escalation_level integer DEFAULT 1,
    escalated_at timestamp without time zone,
    closed_at timestamp without time zone,
    reopened_from_ticket_id character varying,
    reopen_reason text,
    reopened_at timestamp without time zone,
    feedback_status text DEFAULT 'pending'::text,
    feedback_sent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: training_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_records (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_id character varying NOT NULL,
    module_id character varying NOT NULL,
    training_session_id character varying,
    recipient_name text NOT NULL,
    training_hours integer NOT NULL,
    training_date timestamp without time zone NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: training_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_sessions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_id character varying NOT NULL,
    module_id character varying NOT NULL,
    assigned_engineer_id character varying,
    recipient_name text NOT NULL,
    recipient_email text,
    recipient_department text,
    scheduled_date timestamp without time zone NOT NULL,
    scheduled_hours integer NOT NULL,
    status text DEFAULT 'scheduled'::text,
    completed_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_module_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_module_permissions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    module_id character varying NOT NULL,
    can_view boolean DEFAULT false,
    can_create boolean DEFAULT false,
    can_edit boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    granted_by character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_point_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_point_balances (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    total_points integer DEFAULT 0 NOT NULL,
    lead_points integer DEFAULT 0 NOT NULL,
    task_points integer DEFAULT 0 NOT NULL,
    ticket_points integer DEFAULT 0 NOT NULL,
    project_points integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_point_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_point_ledger (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    module_type character varying(20) NOT NULL,
    entity_id character varying NOT NULL,
    category_id character varying,
    action character varying(20) NOT NULL,
    points integer NOT NULL,
    reason text,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_role_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_role_assignments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    role_id character varying NOT NULL,
    is_primary boolean DEFAULT false,
    assigned_by character varying,
    assigned_at timestamp without time zone DEFAULT now(),
    is_active boolean DEFAULT true
);


--
-- Name: user_role_rights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_role_rights (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    role_id character varying NOT NULL,
    module text NOT NULL,
    can_view boolean DEFAULT false,
    can_create boolean DEFAULT false,
    can_edit boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email character varying,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    role character varying(50) DEFAULT 'sales_executive'::character varying NOT NULL,
    password_hash character varying,
    is_email_verified boolean DEFAULT false,
    is_active boolean DEFAULT true,
    is_approved boolean DEFAULT false,
    approved_by character varying,
    approved_at timestamp without time zone,
    auth_provider character varying(20) DEFAULT 'local'::character varying,
    last_login_at timestamp without time zone,
    impersonated_by character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    department_id character varying
);


--
-- Data for Name: activity_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_log (id, entity_type, entity_id, action, description, user_id, metadata, created_at) FROM stdin;
5db670db-7ffd-4c5a-b589-aeef5a128908	user_role	e6494264-b679-4b98-a062-ec2d048537c9	permissions_updated	Role permissions updated for 10 modules	46525611	\N	2025-11-28 12:58:55.002118
680dbfa7-2b13-4f3c-b51b-a1fcd35cfa74	user_role	e6494264-b679-4b98-a062-ec2d048537c9	permissions_updated	Role permissions updated for 10 modules	46525611	\N	2025-11-28 12:59:13.551625
856da878-3a9f-46d3-9bdd-2e6f7a1081f7	user_role	d6dafb1a-573d-4e04-b637-a147b03973ae	permissions_updated	Role permissions updated for 10 modules	46525611	\N	2025-11-28 12:59:58.691573
1be5bbde-8d71-4069-a27a-ed5caacd82da	user	sales_user_abc123	approved	User approved: Santhosh Sales	46525611	\N	2025-11-28 13:22:52.024166
905ea80d-1048-4a88-8d08-40fb840aa0f5	task	a4dbcfab-de37-4eff-80fa-c7e8f0f0f02c	created	Task created: Follow up: Microgenn Software Solutions	46525611	{"assignedTo": "46525611"}	2025-11-28 15:08:03.852148
08e7cab8-5fd8-4e9e-a719-d1a301be24ed	task	3af0330f-701e-4c89-86b0-3cabd35cfb2f	created	Task created: Follow up: Microgenn Software Solutions	46525611	{"assignedTo": "46525611"}	2025-11-28 15:08:06.49438
fa983f39-83e4-49be-a5bf-0a582f7e84fb	task	b76f2c43-6ddf-44f6-8d8e-4e5e443cf480	created	Task created: Follow up: Microgenn Software Solutions	46525611	{"assignedTo": "46525611"}	2025-11-28 15:08:08.724367
3c75c726-17cb-4ccb-a96f-258549b687bc	user	63f037af-1a62-4cc9-9dd6-c018eebbc377	approval_revoked	User approval revoked: Naveen Kumar	46525611	\N	2025-11-28 16:01:15.357022
c0de3c23-ee76-4090-81dd-17fc14bc74d9	user	63f037af-1a62-4cc9-9dd6-c018eebbc377	approved	User approved: Naveen Kumar	46525611	\N	2025-11-28 16:01:34.570992
efa8c33d-cd38-4072-97bc-88bf646deb55	user_role	6b6278c8-4d11-4b76-a742-ac7e3b9a311e	created	New user role created: Sales Head	46525611	\N	2025-11-28 16:02:42.998536
157f1438-268c-44b3-b24a-3a3a06766846	user_role	4a6d9690-6440-4e38-8d31-e68cfebb0f99	updated	User role updated: Business Developement Manager	46525611	\N	2025-11-28 16:03:02.286158
70aa2b46-b747-448f-950a-2eddbabf783e	user	63f037af-1a62-4cc9-9dd6-c018eebbc377	approval_revoked	User approval revoked: Naveen Kumar	46525611	\N	2025-11-29 05:31:40.018343
23db6681-a7af-4536-8799-3f37e36e3d56	task	b76f2c43-6ddf-44f6-8d8e-4e5e443cf480	comment_added	Comment added to task: Follow up: Microgenn Software Solutions	46525611	\N	2025-12-01 13:20:14.417233
36f5cc2b-f11c-480d-91aa-76fd73279999	task	b76f2c43-6ddf-44f6-8d8e-4e5e443cf480	comment_added	Comment added to task: Follow up: Microgenn Software Solutions	46525611	\N	2025-12-01 13:20:56.270773
49924fc2-0744-4640-becb-6b6471deaa32	lead	b6f3393f-080a-406e-9c03-1eb24dcfb23c	updated	Lead updated: Raja Rani - Stage: new_lead	46525611	\N	2025-12-01 13:27:00.397387
d76accd1-a5eb-42d7-83e0-a35f2c27b486	lead	b6f3393f-080a-406e-9c03-1eb24dcfb23c	demo_scheduled	Demo scheduled for Raja Rani on 12/2/2025, 4:30:00 AM	46525611	\N	2025-12-01 13:27:19.9944
f2cbea79-e707-4c64-82f0-1ec5f09e1ae0	system_settings	smtp_config	updated	SMTP configuration updated	\N	\N	2025-12-01 16:19:02.090483
d47f36b7-0151-401a-9293-9002a7206f35	task	9cd785b6-4e1b-411b-9181-d47068e68ae9	created	Task created: Test Task NaCOfv	46525611	{"assignedTo": "test-admin-001"}	2025-12-01 17:20:52.044162
ed0475c4-5554-4353-ae37-198d1c793427	department	a757aa29-69a1-458a-aebf-b36fa423c61d	created	New department created: Sales Department	46525611	\N	2025-12-01 17:53:57.991401
c2854b17-2dfb-4366-a469-ca1a0b0469bd	department	a757aa29-69a1-458a-aebf-b36fa423c61d	updated	Department updated: Updated Sales Dept	46525611	\N	2025-12-01 17:54:46.933374
a63198a2-f4ba-41b5-ac90-e7ea08f19ed3	department	a757aa29-69a1-458a-aebf-b36fa423c61d	updated	Department updated: Updated Sales Dept	46525611	\N	2025-12-01 18:06:36.378552
819372b3-10e0-4075-8a3e-83dc2228473a	ticket	d54287a0-405c-484e-9b23-623bf065b3b9	updated	Ticket updated: TKT-000003 - Status: closed	46525611	\N	2025-12-01 18:43:13.235669
1741a3b8-0463-47ba-be00-ffac934f4ce2	ticket	d54287a0-405c-484e-9b23-623bf065b3b9	closed	Ticket closed: TKT-000003	46525611	\N	2025-12-01 18:43:22.106179
e88ecd39-6604-4f69-bf87-8f91914ad1ce	ticket	a9fccb62-9532-4d4c-9222-acd81df97fef	reopened	Ticket reopened from TKT-000003: As per customer feed back	46525611	\N	2025-12-01 18:43:42.773502
\.


--
-- Data for Name: attachments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.attachments (id, entity_type, entity_id, file_name, file_type, file_size, object_path, uploaded_by, created_at) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (id, name, contact_person, designation, email, phone, alternate_phone, website, industry, company, gst_number, pan_number, address, city, state, country, pincode, status, customer_type, selected_modules, notes, created_at, updated_at) FROM stdin;
7f2c4395-e9bd-41df-82f4-595f31ae38e6	Test Customer ABC	\N	\N	test.customer@example.com	+1234567890	\N	\N	\N	Test Company Ltd	\N	\N	123 Test Street	New York	NY	USA	\N	active	prospect	\N	Contact Person: John Doe	2025-11-28 12:41:54.329884	2025-11-28 12:41:54.329884
d88a64d8-2328-4d0e-b317-9cfc419ace37	Test Customer t2sQTb	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	active	prospect	{"Front Office"}	\N	2025-11-28 12:41:54.329884	2025-11-28 12:41:54.329884
abcaebf2-319f-4a57-bfdf-eb1925653e2e	ModuleTest qhZEhu	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	active	prospect	{Accounting}	\N	2025-11-28 12:41:54.329884	2025-11-28 12:41:54.329884
393d246c-5a79-43ff-9680-7d1775040b84	Microgenn Software Solutions	\N	\N	contact@microgenn.com	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	active	prospect	\N	\N	2025-11-28 12:41:54.329884	2025-11-28 12:41:54.329884
1f60a117-024e-4457-8e0f-a85a479347d1	Sri Bhagavathi Residency	\N	\N	contact@sribhagavathi.com	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	active	prospect	\N	\N	2025-11-28 12:41:54.329884	2025-11-28 12:41:54.329884
\.


--
-- Data for Name: demo_date_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.demo_date_history (id, lead_id, demo_date, changed_by_id, change_reason, created_at) FROM stdin;
1bd3f33f-d7d6-4224-ac17-6259c18c6e78	b6f3393f-080a-406e-9c03-1eb24dcfb23c	2025-12-02 04:30:00	46525611	Initial scheduling	2025-12-01 13:27:19.949353
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.departments (id, name, description, manager_id, is_active, created_at, updated_at) FROM stdin;
a757aa29-69a1-458a-aebf-b36fa423c61d	Updated Sales Dept	Handles all sales activities	sales_user_abc123	t	2025-12-01 17:53:57.966434	2025-12-01 18:06:36.341
\.


--
-- Data for Name: escalation_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.escalation_history (id, ticket_id, from_level, to_level, reason, escalated_by, escalated_at) FROM stdin;
ea1398ab-34f5-49ad-9c77-6ca9e56bb4e5	d54287a0-405c-484e-9b23-623bf065b3b9	1	2	Escalated by user	46525611	2025-11-28 12:44:46.796793
ac515a6b-77cf-46d3-b727-4cc3453bd7f5	d54287a0-405c-484e-9b23-623bf065b3b9	2	3	Escalated by user	46525611	2025-11-28 12:44:46.796793
\.


--
-- Data for Name: feedback; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feedback (id, ticket_id, rating, comments, satisfied, submitted_at) FROM stdin;
\.


--
-- Data for Name: follow_ups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.follow_ups (id, lead_id, notes, follow_up_date, completed, created_at) FROM stdin;
6ffbe11e-a2f8-4125-be6b-87830a655c97	7a859167-b4a1-4c10-a895-c01739fd11ca	nxt fllup	2025-11-26 06:30:00	f	2025-11-28 12:44:50.914027
\.


--
-- Data for Name: knowledge_base_chunks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.knowledge_base_chunks (id, source_id, chunk_index, content, language_code, token_count, metadata, created_at, embedding) FROM stdin;
13576eb8-4a4b-4f62-b760-c02fee0c30ee	e4569aca-e5a4-4cd8-bb41-835710b0c4ed	0	# M-CRM Overview\n\nM-CRM is a comprehensive Customer Relationship Management platform designed to streamline sales pipeline management, implementation projects, and customer support.\n\n## Key Features\n\n### 1. Sales Management\n- Lead tracking from 11+ social media platforms\n- Sales pipeline with Kanban board visualization\n- Quote generation and management\n- Follow-up scheduling and reminders\n- Negotiation tracking\n\n### 2. Implementation Management\n- 6-step implementation workflow\n- Module-based installation scheduling\n- Training session management\n- Daily progress tracking with photo/video proof\n- Work tracking dashboard\n\n### 3. Support Management\n- Multi-level ticket system (L1, L2, L3)\n- Priority-based ticket handling\n- Escalation workflows\n- Customer feedback collection\n- SLA tracking\n\n### 4. Task Management\n- Voice and video recording attachments\n- Photo capture capabilities\n- File attachments\n- Reminder scheduling\n- Team collaboration features\n\n## User Roles\n- **Sales Executive**: Manages leads and sales pipeline\n- **Engineer**: Handles implementation projects\n- **Support**: Manages support tickets\n- **Admin**: Full system access and configuration\n\n## Getting Started\n1. Log in with your credentials\n2. Navigate to the Dashboard for an overview\n3. Use the sidebar to access different modules\n4. Check My Tasks for pending work items	en	338	{"endPosition": 1352, "startPosition": 0}	2025-11-28 13:01:31.948003	\N
ff3f6b79-4f14-42b6-b188-35f136300204	7799d270-236f-4a22-bc41-2865749728f8	0	# Support Ticket System Guide\n\n## Creating a Support Ticket\n\n### Step-by-Step Process\n1. Navigate to **Support → Tickets** from the sidebar\n2. Click **"New Ticket"** button\n3. Fill in the required fields:\n   - **Customer**: Select from existing customers\n   - **Subject**: Brief description of the issue\n   - **Description**: Detailed explanation of the problem\n   - **Priority**: Low, Medium, High, or Critical\n   - **Category**: Technical, Billing, General, Feature Request\n4. Click **Create Ticket**\n\n### Automatic Ticket Numbering\nTickets are automatically numbered as TKT-XXXXXX for easy reference.\n\n## Ticket Priority Levels\n\n### Low Priority\nMinor issues or questions. No immediate business impact. Response within 48 hours.\n\n### Medium Priority\nModerate issues affecting workflow. Workaround available. Response within 24 hours.\n\n### High Priority\nSignificant issues affecting operations. No workaround available. Response within 4 hours.\n\n### Critical Priority\nSystem down or major functionality broken. Business operations halted. Immediate response required.\n\n## Escalation Process\n\n### Three-Level Escalation\n\n**Level 1 (L1) - Initial Support**\nFirst point of contact. Basic troubleshooting. Common issue resolution.\n\n**Level 2 (L2) - Technical Specialist**\nComplex technical issues. Deeper investigation. Access to development resources.\n\n**Level 3 (L3) - Senior Engineer/Management**\nCritical system issues. Requires management decision. Potential code changes needed.\n\n### How to Escalate\n1. Open the ticket\n2. Click **"Escalate"** button\n3. Select the next level\n4. Add escalation reason\n5. Assign to specific person or let system assign\n\n## Ticket Status Flow\n1. **New** - Just created, awaiting assignment\n2. **Open** - Assigned and being worked on\n3. **Pending** - Waiting for customer response\n4. **Resolved** - Solution implemented\n5. **Closed** - Confirmed resolved	en	472	{"endPosition": 1887, "startPosition": 0}	2025-11-28 13:01:32.556709	\N
61a94230-b076-4425-8b2a-cc587a0ec93f	6fd0fc89-7e41-4c5b-8a2a-e471afa1d7fc	0	# Admin Guide - User Management\n\n## Overview\nThe User Management module allows administrators to create users, define roles, and configure permissions for the M-CRM system.\n\n## User Management\n\n### Creating a New User\n1. Navigate to **Admin → User Master**\n2. Click **"Add User"** button\n3. Fill in user details:\n   - Name and email\n   - Role assignment\n   - Department (optional)\n4. User will receive login credentials via email\n\n### User Approval Workflow\nNew user registrations require admin approval:\n1. Go to **Admin → User Approval**\n2. Review pending registrations\n3. Click **Approve** or **Reject**\n4. Approved users can immediately access the system\n\n## Role Management\n\n### Creating Roles\n1. Navigate to **Admin → User Role Master**\n2. Click **"Add Role"**\n3. Enter role name and description\n4. Save the role\n\n### Configuring Permissions\n1. Go to **Admin → User Rights Allocation**\n2. Select a role from dropdown\n3. For each module, set permissions:\n   - **View**: Can see the module\n   - **Create**: Can add new records\n   - **Edit**: Can modify existing records\n   - **Delete**: Can remove records\n4. Click **Save Changes**\n\n## Best Practices\n- Follow principle of least privilege\n- Review user access periodically\n- Disable inactive users instead of deleting\n- Document role changes for audit purposes	en	329	{"endPosition": 1314, "startPosition": 0}	2025-11-28 13:01:30.9295	\N
c07a944e-38fc-4b37-b737-703aacc347a8	da7eb6ef-3a45-4a16-9296-f395c3e17e83	0	# Implementation Module Guide\n\n## Creating a New Project\n\n### Step-by-Step Process\n1. Navigate to **Implementation → Projects** from the sidebar\n2. Click **"New Project"** button\n3. Select the customer from the dropdown\n4. Assign one or more engineers to the project\n5. Set the target completion date\n6. Click **Create Project**\n\n### Automatic Module Creation\nWhen a project is created, the system automatically creates 8 module checklists:\n\n1. **Front Office** - Reception, appointment booking, visitor management\n2. **Power Automation** - Workflow automation and business rules\n3. **POS (Point of Sale)** - Sales transactions and billing\n4. **Inventory** - Stock management and tracking\n5. **HR & Payroll** - Employee management and salary processing\n6. **Accounting** - Financial management and reporting\n7. **CRM Integration** - Customer data synchronization\n8. **Reporting** - Custom reports and dashboards\n\n## Tracking Project Progress\n\n### Module Status Updates\nEach module can be in one of these states:\n- **Planning** - Requirements gathering phase\n- **In Progress** - Active implementation\n- **Completed** - Fully implemented and tested\n\n### Adding Progress Entries\n1. Open the project details\n2. Click on a specific module\n3. Click **"Add Progress Entry"**\n4. Fill in work description and hours spent\n5. Attach photos/videos as proof\n6. Save the entry\n\n## Training Records\n\n### Logging Training Sessions\n1. Open the project\n2. Go to **Training** tab\n3. Click **"Add Training Record"**\n4. Fill in module, attendees, duration, topics covered\n5. Save the record\n\n## Project Handover\n\n### Completing a Project\n1. Ensure all modules are marked as Completed\n2. All training sessions are documented\n3. Create handover documentation\n4. Move project to **Support** phase	en	443	{"endPosition": 1772, "startPosition": 0}	2025-11-28 13:01:33.360882	\N
75e871d6-796f-4bed-ad1d-89844fd04f39	a19423a7-4076-460b-9ac0-9effada567d1	0	# Sales Management Guide\n\n## Creating a Lead\n\n### Step-by-Step Process\n1. Navigate to **Sales → Leads** from the sidebar\n2. Click the **"Add Lead"** button in the top right\n3. Fill in the required fields:\n   - **Customer Name**: Company or individual name\n   - **Contact Person**: Primary contact for communication\n   - **Email**: Valid email address\n   - **Phone**: Contact phone number\n   - **Lead Source**: How the lead was acquired (Website, Referral, Social Media, Cold Call, Exhibition, Advertisement, Partner, Other)\n   - **Assigned Sales Executive**: Team member responsible for this lead\n4. Add optional notes or requirements\n5. Click **Save** to create the lead\n\n## Lead Stages\n\nLeads progress through 5 stages in the sales pipeline:\n\n### 1. New Lead\nFresh inquiry just received. No contact made yet.\n\n### 2. Contacted  \nInitial contact has been made. Customer is aware of our interest.\n\n### 3. Qualified\nRequirements are understood. Customer shows genuine interest. Budget and timeline discussed.\n\n### 4. Proposal\nQuote/proposal has been sent. Awaiting customer decision.\n\n### 5. Closed\nFinal stage - either Won or Lost.\n\n## Managing Quotes\n\n### Creating a Quote\n1. Open the lead details page\n2. Click **"Create Quote"** button\n3. Add line items with product/service, description, quantity, and unit price\n4. Apply discounts if applicable\n5. Add terms and conditions\n6. Click **Save Quote**\n\n## Follow-up Management\n\n### Scheduling Follow-ups\n1. Open any lead\n2. Click **"Add Follow-up"**\n3. Set the follow-up date and time\n4. Add notes about what to discuss\n5. Save the follow-up\n\n## Best Practices\n- Update lead status promptly as it changes\n- Add detailed notes after every interaction\n- Schedule follow-ups immediately after calls\n- Keep quotes valid for 30 days maximum\n- Document reasons for lost deals	en	455	{"endPosition": 1819, "startPosition": 0}	2025-11-28 13:01:33.707703	\N
de0a354e-1ca4-4790-99c4-e050b1fab2e0	cc4a84d4-0e55-44f5-8fb6-30a092dec69d	0	# M-CRM UI Standards and Conventions\n\n## Overview\nThis guide documents the UI standards used across the M-CRM application to ensure visual consistency and professional appearance.\n\n## Page Headers\n\n### Standard Header Size\nAll page headers use consistent sizing:\n- **Desktop**: `text-xl` (1.25rem / 20px)\n- **Mobile**: `text-lg` (1.125rem / 18px)\n- **Weight**: `font-bold`\n- **Pattern**: `className="text-lg sm:text-xl font-bold"`\n\n### Header with Icons\nWhen headers include icons:\n- Icon size: `h-5 w-5` (1.25rem / 20px)\n- Gap: `gap-2` between icon and text\n- Pattern: `className="text-lg sm:text-xl font-bold flex items-center gap-2"`\n\n### Page Description\nBelow each header:\n- Text: `text-sm text-muted-foreground`\n- Margin: `mb-1` on the header\n\n## Sidebar Design\n\n### M-CRM Branding\n- Logo and "M-CRM" text in sidebar header\n- Text size matches page header sizing\n- Consistent navy blue background with light text\n\n### Menu Items\n- Full text displayed without truncation\n- `whitespace-nowrap` prevents text wrapping\n- Tooltips show full text on hover for collapsed items\n- Icons sized consistently at `h-4 w-4`\n\n### Nested Menus\nCollapsible sub-menus for:\n- User Management (4 sub-items)\n- System Settings (2 sub-items)\n- Reports (3 sub-items)\n\n## Component Patterns\n\n### Cards\n- Used for content grouping\n- Consistent padding and spacing\n- Headers with titles and descriptions\n\n### Buttons\n- Primary: Default blue for main actions\n- Outline: For secondary actions\n- Ghost: For subtle actions\n- Consistent height using built-in sizes\n\n### Forms\n- Labels above inputs\n- Consistent input heights\n- Validation messages below fields\n- Submit buttons aligned right\n\n### Tables\n- Zebra striping for readability\n- Action buttons in rightmost column\n- Consistent column widths\n\n## Responsive Design\n\n### Breakpoints\n- **Mobile** (<640px): Single column, stacked layouts\n- **Tablet** (640px-1024px): Two columns where appropriate\n- **Desktop** (>1024px): Full multi-column layouts\n\n### Mobile Considerations\n- Touch-friendly button sizes (min 44px)\n- Collapsible sidebar\n- Stacked form layouts\n- Horizontal scroll for tables\n\n## Dark Mode\n\n### Implementation\n- CSS variables for colors\n- Automatic switching via `dark:` classes\n- Consistent contrast ratios\n- Chart colors adapt to theme\n\n### Color Variables\n- `--background` and `--foreground` for base\n- `--primary` for brand color\n- `--muted` for secondary text\n- `--border` for separators\n\n## Accessibility\n\n### Standards\n- Semantic HTML elements\n- ARIA labels on interactive elements\n- Focus indicators visible\n- Color contrast meets WCAG AA\n\n### Test IDs\n- `data-testid` on all interactive elements\n- Pattern: `{action}-{target}` (e.g., "button-save")\n- For lists: `{type}-{id}` (e.g., "row-user-123")\n\n## Best Practices\n\n### Consistency\n- Use shared components over custom styling\n- Follow established patterns for new features\n- Match sizing and spacing to existing pages\n\n### Performance\n- Lazy load heavy components\n- Optimize images\n- Minimize re-renders with proper state management\n\n### Maintenance\n- Document new patterns in this guide\n- Review UI changes for consistency\n- Test across all breakpoints	en	790	{"endPosition": 3160, "startPosition": 0}	2025-12-01 18:52:51.33318	[0.01032286,0.08599582,0.05341773,0.04330818,0.0028425034,-0.014492081,0.0048446986,-0.011809559,-0.024989465,0.028079214,-0.013819834,-0.04798805,-0.025222167,0.012850248,0.022959799,0.06169153,-0.015371172,0.019094381,-0.019365866,0.011602714,0.049435962,0.018241147,0.005510481,0.052486926,-0.008008781,0.016844943,-0.010924003,0.048013903,0.0063507888,-0.018952176,0.033327907,-0.016702736,0.003555149,0.016689809,0.011382941,-0.0021815686,-0.010503849,0.04579032,0.021641161,0.006486531,-0.05341773,-0.00011332038,0.043515023,0.025286805,-0.019831268,0.011466972,-0.0015044744,0.02939785,0.008170379,0.03844732,-0.016418325,0.009967345,0.029501272,0.0075239884,-0.026967421,-0.009327418,-0.030276943,-0.016172696,0.005216373,0.023050293,0.029785685,-0.00031531748,-0.01639247,-0.035835903,-0.011615641,-0.0034937419,-0.02769138,-0.023619117,0.028984161,-0.010710695,0.081393525,-0.010154799,0.009243388,-0.008525894,0.038550742,-0.06158811,0.009107646,0.028906593,0.015991706,-0.04703139,-0.017555973,-0.050832167,-0.040515773,-0.050651178,-0.035215367,0.004547359,-0.030561354,-0.010232366,-0.04028307,0.02211949,-0.04010208,0.017659394,-0.040153794,0.006825886,0.015629727,-0.03348304,-0.015901212,0.012546444,-0.0044924156,0.022274625,0.070534155,-0.0502892,-0.040903606,-0.015720222,0.06789688,-0.016819088,0.013651772,-0.0015440659,-0.056003295,-0.019624423,-0.08547871,-0.0021120817,-0.00040823614,0.046514276,0.023425201,-0.0010560409,0.009889779,5.6205696e-05,-0.02206778,-0.073326565,-0.009741108,0.017245704,0.0041530603,-0.03746481,0.009308026,0.00529394,-0.012093971,0.00795707,-0.061743245,-0.01204226,0.019921763,0.015578017,0.035060234,-0.057709765,-0.02549365,0.027381111,-0.013561278,0.015759006,-0.047651924,-0.0014115558,0.024588704,-0.022584893,0.036663283,-0.0027584725,-0.04188612,-0.045919597,-0.026993277,0.038705878,-0.04242909,0.032500528,-0.0052777804,-0.008745667,-0.042868633,-0.021408461,-0.010219437,-0.058899123,0.04775535,0.01200994,0.0029620857,-0.07296459,0.0381112,-0.000279564,-0.02183508,-0.020038113,0.013031237,-0.054451957,-0.04767778,-0.005953259,-0.047651924,0.0062473663,0.02691571,-0.036637425,-0.0063281655,-0.038007773,0.027406966,0.020141535,-0.012404238,0.00051428465,0.0020991538,0.045764465,0.023127861,-0.004243555,-0.026579587,-0.04423898,-0.044678528,-0.011635033,-0.03914542,-0.011958228,-0.038705878,-0.025868557,0.01915902,0.000554684,-0.024808476,-0.015927067,0.00012766218,-0.0015553777,0.033276197,-0.029501272,0.0060502174,0.043980427,-0.0007433494,0.017013004,0.056416985,-0.011059745,0.0010358412,-0.008868481,-0.055227626,0.06417367,-0.025946124,-0.022817593,0.0192883,-0.0077566886,0.011505755,0.015332389,-0.059312813,-0.044807807,-0.026204681,0.009734645,0.0050515435,0.036637425,-0.026476165,0.019960545,0.025907341,-0.04863444,0.0021848008,0.04899642,0.05538276,-0.055589605,-0.0027277688,-0.0023674062,0.016431253,-0.004705725,-0.008642244,0.046462566,0.0127209695,-0.07446421,0.0064606755,0.017543044,0.0036133241,0.0021718729,0.028518759,0.066190414,-0.03159558,-0.025648784,0.033508897,0.0068129585,-0.044264838,-0.08097983,0.02727769,-0.0011635033,0.06344972,-4.7974314e-05,0.0024271973,0.0073300707,0.00461523,0.007310679,0.008079885,0.041369006,-0.01219093,-0.03325034,-0.08646122,-0.018499702,-0.031311166,-0.020154463,-0.012229713,0.0043340498,-0.031233601,0.017956736,-0.0005239805,-0.0086680995,-0.011848343,0.011667353,0.0388093,0.03875759,-0.014026679,-0.041549996,-0.02714841,0.028984161,-0.018628981,-0.008842626,-0.017814528,-0.03361232,0.05708923,-0.0019666438,-0.0046572452,0.035835903,0.006341093,0.011163168,-0.018525558,-0.047134813,-0.01857727,0.017814528,-0.011906518,-0.021628235,-0.023632046,0.025441939,0.02473091,0.004262947,-0.021253327,-0.01917195,-0.0036197882,0.017103499,0.00020846102,-0.0016935437,0.043515023,0.02916515,0.030845765,-0.01100157,-0.007944142,-0.00028016997,-0.004250019,-0.035241224,0.03141459,-0.03330205,-0.058433723,-0.020206174,0.032578092,0.034026008,-0.006825886,-0.023761323,-0.004757436,-0.0051969816,0.004250019,-0.023140788,0.003416175,-0.027381111,-0.032397103,-0.010995107,-0.0140525345,-0.063863404,0.03317277,-0.07632582,0.020658648,-0.0044924156,-0.024692126,0.006282918,-0.0028231116,0.023800107,-0.045919597,0.010904612,-0.032448813,-0.05471051,-0.044756096,-0.010051376,0.0005785197,-0.05336602,-0.065828435,-0.02259782,0.018267002,0.021085266,-0.031440444,0.028130924,0.040800184,0.021757511,-0.036223736,0.026114186,-0.00073607743,-0.03154387,-0.041007027,-0.009249851,-0.039533257,-0.02957884,0.015293605,-0.023916457,0.0028925985,0.04840174,-0.045635186,0.044032138,0.017840384,-0.022390975,-0.0045570545,-0.018111868,0.017387912,0.01940465,-0.065828435,0.012093971,-0.0190556,-4.3580876e-05,0.003632716,-0.0019117006,0.038188763,0.0009348426,0.010639591,-0.025920268,0.06412196,0.00069891,0.029113438,0.007142618,-0.022688314,0.006554402,-0.02957884,-0.006754783,0.001326717,-0.014130102,0.028415337,0.058226876,0.008881409,0.020606937,0.04506636,-0.003412943,0.036663283,0.0029588535,-0.025713423,0.017025933,-0.011971156,-0.050728746,-0.015448739,-0.004931961,-0.048789572,-0.005865996,0.011040354,-0.018435065,0.00840308,-0.0015747694,0.029630551,-0.013470783,0.010393963,0.011874198,0.029682262,0.038059488,-0.027070845,-0.04863444,-0.004521503,-0.03756823,-0.031285312,0.025635857,0.0055718883,-0.018409207,-0.006053449,-0.05708923,-0.018098941,0.019857123,0.07482619,0.024511136,-0.043747727,0.02466627,0.017646467,-0.0251446,0.040955316,-0.01680616,0.014233524,-0.022933943,-0.0062570623,0.0035131336,-0.0069034533,-0.0029507738,-0.02271417,-0.05543447,-0.004337282,-0.031621434,-0.047600213,0.045092218,0.0034517266,-0.019391723,-0.018590197,0.018086012,0.07208549,-0.018318713,-0.006341093,-0.012022868,0.04235152,0.05915768,0.04229981,0.04863444,0.016289046,-0.010633128,-0.040489916,0.028286058,0.03756823,-0.039352268,0.04920326,-0.011040354,0.030975044,0.004686333,0.0043631373,-0.035396356,-0.010180654,-0.018021373,0.010309932,-0.013011846,0.03932641,0.0030897476,-0.030897478,0.0027455445,0.028777316,0.07456764,-0.012830856,0.0036908912,-0.0063604848,0.039714247,0.0020425948,0.009799284,-0.0059015476,-0.013470783,-0.034956813,-0.021692874,0.017530117,-0.030251086,-0.032086834,-0.007530452,0.012048723,-0.010839973,-0.010400427,0.05631356,-0.013742267,-0.0060372893,-0.017400838,0.0054199863,0.012501197,-0.010600808,-0.03774922,-0.011260127,0.0052002133,0.013587133,-0.03692184,0.008015245,0.0038137054,0.005164662,0.0031705466,0.018189436,-0.019430505,0.020606937,-0.018447991,-0.0013711563,0.016534675,0.0057399496,-0.029630551,-0.025429012,-0.01253998,-0.046074733,-0.013341505,-0.010309932,0.009896242,0.006538242,-0.023851817,0.010581416,-0.015306532,-0.0158495,0.008506502,-0.010975715,0.027949935,-0.014065462,0.014698925,-0.014505008,0.015823646,0.026152968,0.0068129585,-0.0016628401,0.030794054,0.0043437458,0.011790167,-0.0011271439,0.024756765,-0.012552908,0.0010366491,0.009553655,0.00392036,-0.03710283,0.015190182,0.00041571003,-0.006922845,-0.039429836,-0.0027859441,-0.00069891,-0.055744737,-0.011344157,0.01005784,0.0035034379,-0.020619864,0.026152968,0.00987685,-0.02952713,0.0023156947,0.00949548,0.015216038,-0.019417578,0.003202866,-0.027768945,0.01626319,0.048841283,-0.06277747,-0.012636939,0.005520177,0.023709612,-0.0753433,0.031802423,0.015526306,-0.012973062,0.024873115,0.030613065,0.005248693,0.0100384485,-0.00818977,0.043463312,-0.0022462078,0.019882979,-0.01568144,0.018305786,-0.0077308333,-0.008396615,0.035008524,-0.030975044,0.002023203,-0.022959799,-0.012559372,0.028182637,0.0019020047,-0.010439211,-0.024524065,0.01685787,-0.011247199,0.03472411,0.002855431,-0.022132419,-0.011951765,0.042273954,0.029216861,-0.003626252,0.04915155,-0.00486409,-0.055641316,0.00024946642,0.01568144,0.010251757,0.029630551,-0.012914887,0.020348381,-0.023295922,-0.0040302463,-0.011589786,0.0096764695,0.024679199,0.039067857,-0.03650815,-0.019960545,0.0051258784,0.027432824,-0.007375318,0.0009808979,-0.009747572,0.023334706,0.015952924,0.00377169,0.026631298,0.014918698,0.0014794267,-3.5223246e-05,0.010219437,-0.047083102,-0.008176843,-0.023166643,-0.007200793,0.012973062,0.020141535,0.008448327,0.0024336611,-0.009353274,0.024511136,-0.030070096,0.042377375,-0.043566737,0.036301304,-0.031983413,-0.009928562,-0.017594757,0.038705878,0.0012927814,0.019727845,-0.02200314,0.016935438,-0.03366403,0.03265566,0.045945454,0.041084595,0.012061651,0.014828203,0.035344645,-0.012178002,-0.008054028,0.012565836,-0.031854134,0.0017565668,-0.02916515,-0.008066956,-0.016651025,-0.030794054,0.013432,0.029630551,0.042506654,0.0069034533,0.039610825,-0.0041724523,0.0050677033,-0.028130924,-0.0064089643,0.037594084,0.0031252992,0.01573315,0.0074981325,-0.12286595,0.028130924,0.016612241,0.007969998,0.028389482,0.001042305,-0.01786624,-0.025222167,-0.013031237,0.006922845,-0.020503514,-0.0041627563,0.017193994,-0.04302377,0.005930635,-0.0069422363,-0.005358579,-0.010671911,0.01839628,0.00037207868,0.005510481,-0.02668301,0.035396356,-0.03242296,-0.0113312295,0.026889855,0.010303468,-0.011751384,0.022921015,-0.022559037,-0.021279182,-0.011079137,0.048841283,-0.0019957314,0.015823646,-0.026204681,0.028467048,-0.020257886,0.0052034454,-0.038654167,0.012281424,-0.0388093,-0.0047671315,-0.03767165,-0.030975044,-0.0008241482,-0.0020102751,-0.04858273,0.03330205,-0.016728593,0.029449562,0.026411526,0.01129891,-0.03968839,-0.011583322,-0.010031984,-0.013793978,-0.0028053357,0.030664777,-0.00919814,0.051039014,0.0134449275,0.074153945,-0.024640415,0.0048931777,-0.0066578244,-0.019391723,0.035499778,0.009353274,-0.04010208,0.035163656,0.00078617275,0.015358244,-0.010445674,-0.014298163,0.008176843,-0.014983337,-0.024743838,-0.020917205,-0.014517936,-0.020063968,0.0110468175,-0.035525635,0.028286058,-0.0046249256,-0.013936184,-0.030432075,-0.030794054,0.008247945,-0.0046346216,-0.031285312,-0.050134066,0.035758335,0.009139965,-0.009146429,-0.01550045,0.012178002,0.0062667583,-0.09152893,-0.016728593,0.015539234,-0.0079635335,-0.017788673,0.013729339,0.015836572,-0.0032206418,0.036844272,-0.04312719,-0.013179907,0.0270967,-0.011208415,0.005316564,0.025907341,-0.020671576,0.0014883147,0.005449074,0.03728382,0.027251834,0.0116738165,-0.014207669,0.0070456592,0.012132755,-0.016017562,-0.057606343,0.007052123,-0.011260127,0.046359144,-0.011589786,-0.00078455673,0.030432075,-0.008493574,0.012953671,0.011072673,0.026075402,0.0151384715,-0.028596327,-0.016056346,-0.007944142,0.018771186,-0.019779557,0.008777986,0.0062570623,-0.0024514368,-0.035603203,-0.021085266,0.034749966,-0.04584203,0.02460163,-0.013625917,-0.018564342,-0.0017145515,0.0085905325,-0.00893312,-0.0096958615,-0.040386494,0.009547191,-0.01485406,0.0388093,0.010600808,0.009023614,0.013263938,-0.01745255,0.019352939,0.0040140864,-0.025894413,-0.022856377,-0.010982178,0.041084595,0.030561354,0.05595158,-0.01467307,0.0075627714,0.0047089565,-0.0043696016,0.0033062885,-0.0022009604,0.017349128,-0.015190182,0.014944553,-0.0027520086,0.037956063,0.005248693,-0.009133501,0.0019213965,0.0017404071,-0.003063892,0.025519507,0.007608019,-0.014155957,0.023386417,0.013574205,-0.008196235,-0.001331565,-0.026864,0.017724033,0.0036133241,0.03190585,-0.0018422136,0.034930956,-0.013716412,0.014866987,0.022326335,-0.03914542,0.017607683,-0.028208492,-0.07311972,-0.007931215,0.008790914,-0.022571964,0.02195143,0.015720222,0.012236177,-0.029010016,-0.022080708,0.009404985,0.02496361,0.008629316,0.0010245293,0.007918286,0.01005784,-0.011544539,0.007679122,-0.03940398,0.019870052,0.013638845,0.01076887,0.013755195,0.015345316,0.027251834,0.037723362,-0.023399344,0.029061727,-0.032629803,-0.0027002974,0.013625917,0.0069487006,-0.016405396,-0.017685251,0.008564677,0.007679122,-0.023916457,0.019146094,-0.0008023325,-0.010193582,-0.050082356,0.025816847,0.025403155,0.015125543,0.034413844,0.02638567,0.01586243,0.029733974,-0.0054652337,0.008215627,-0.040722616,-0.059312813,0.025842702,0.008125132,-0.018447991,0.032629803,-0.010051376,-0.022959799,0.025480723,-0.014582575,-0.033146918,0.04584203,0.031750713,0.0116738165,0.009101181,0.010064304,0.03247467,0.007181401,0.011615641,0.05388313,0.017297417,-0.029010016,0.021498956,0.011253662,-0.06577672,0.04739337,-0.0037975456,0.010103087,0.043980427,0.0007259776,-0.011143777,-0.021912646,-0.010439211,0.019210733,0.01615977,0.01144758,0.0010358412,-0.002230048,-0.013819834,-0.0070779785,0.058899123,-0.009708789,0.007821328,-0.0063087735,0.029837396,0.04372187,0.0063734124,-0.010710695,0.024356004,0.005594512,-0.026295176,0.02774309,0.004967513,0.014543791,3.8404698e-05,0.03319863,-0.0127597535,0.0007393094,0.00742703,0.011059745,-0.018784115,0.004540895,0.00014523591,-0.000349657,0.011156704,-0.0055395686,-0.023864746,-0.008609924,0.028208492,0.012178002,-0.025131673,0.0106202,0.005167894,0.024562849,-0.010930467,0.03340547,0.0015133623,-0.036999404,0.0249119,0.00056882383,0.027432824,0.018215291,0.014272307,0.007401174,0.0068000304,-0.015668511,-0.03172486,-0.03319863,-0.01591414,0.012792072,0.020387163,0.021085266,-0.04537663,0.0042726425,-0.007174937,0.014362802,0.037542373,-0.03340547,0.013677628,0.0127015775,0.009670005,0.025041178,0.030742344,0.004948121,0.0046249256,0.037413094,-0.009870387,-0.019870052,0.010277613,0.010432746,-0.01378105,-0.017439622,0.007459349,0.0049804407,0.0066513605,-0.013496638,-0.016883725,-0.005510481,0.004563519,0.013987895,-0.034336276,-0.007853648,-0.015216038,-0.029733974,-0.03449141,0.0017371752,-0.0015060904,0.018292857,0.023218356,-0.023593262,-0.018654836,-0.06489763,0.03299178,-0.024769694,0.01644418,-0.0063604848,0.008874944,-0.033146918,0.0116738165,-0.027872369,-0.03767165,-0.004789755,-0.0002650202,0.0031915542,0.03004424,0.0027423126,0.03260395,-0.006347557,-0.00062295905,-0.024536991,0.015836572,-0.042273954,0.02999253,0.014181812,0.00016715261,-0.029449562,0.0007877887,-0.020955987,0.029475417,-0.021343822,-0.020787926,-0.0018066621,-0.01644418,-0.012824392,0.01076887,0.062570624,0.028932448,-0.0051937494,-0.007258968,0.009973809,0.0053294916,-0.0061827274,-0.014685998,-0.012145682,-0.023968168,0.009818675,-0.013587133,0.030690633,0.0031576187,0.011389405,-0.022675388,-0.025635857,0.02408452,-0.003839561,0.002031283,-0.009915634,-0.019857123,-0.01703886,0.04542834,0.0021767209,0.03454312,-0.0011368397,-0.042325664,-0.0051194145,0.07084443,-0.0016515283,-0.0068775974,0.012106898,0.032681517,-0.0022219683,0.0051194145,0.025622929,-0.02277881,-0.032862507,-0.03738724,0.009172285,0.00015149784,0.0059629544,0.012843784,-0.017336199,-0.02289516,0.01632783,0.03668914,0.009670005,0.046979677,0.0059047793,0.020555226,-0.023541551,0.036353014,-0.036120314,0.014556719,-0.03400015,-0.00039995427,0.021343822,-0.013154051,-0.023864746,0.01692251,-0.011357085,-0.01586243,-0.023476912,-0.010878756,0.020477658,0.01910731,-0.007769617,0.0011247199,-0.030949188,0.030897478,-0.006354021,0.007517524,-0.028932448,-0.033043493,-0.010225901,0.008616389,-0.013199299,-0.017814528,7.221397e-05,-0.0052196053,-0.006916381,-0.0064445157,-0.013871545,0.021860935,0.055331048,0.002855431,-0.031181889,-0.020244958,0.07358512,0.016547604,-0.0038524887,0.00033733516,0.009043006,-0.006909917,-0.008293193,-0.04261008,-0.017943807,-0.0024336611,-0.003926824,0.014931626,0.029630551,-0.016366614,0.0030348045,-0.006463907,0.010465066,0.005769037,-0.009417913,-0.0065899533,0.003144691,-0.027768945,0.040567484,-0.02704499,0.0068840613,0.0310009,-0.036456436,-0.04441997,0.028570471,0.007608019,0.006612577,-0.006001738,0.033793308,0.005885388,-0.0025855629,-0.017517189,-0.0066642887,0.016198551,0.0028376554,-0.0034549586,-6.691154e-05,0.0011408797,-0.0026259623,-0.046695266,0.024950683,0.0032529614,-0.015720222,0.0033256803,-0.009566583,-0.021266256,-0.00068153825,0.022041924,-0.0013606525,-0.010613736,-0.00840308,0.015164327,0.03591347,-0.034336276,-0.03454312,0.020167392,0.006354021,-0.0050353836,-0.022494398,-0.035448067,0.020296669,-0.025002394,0.0036230201,0.00038480447,0.0022494397,-0.018771186,0.00418538,-0.020425947,-0.0014325634,-0.03400015,0.009269243,0.011466972,-0.008157451,-0.036895983,-0.0027406968,-0.02638567,0.014104246,-0.004127205,0.022843448,0.009159356,0.017219849,-0.0036488757,0.01745255,-0.0064671393,0.010232366,-0.022623675,-0.02957884,0.036611572,0.0032335697,-0.011014498,-0.05080631,0.0036779633,-0.01893925,0.028286058,0.017956736,-0.023489838,-0.0077114413,-0.0019424042,0.0068194224,0.029501272,-0.00656733,-0.0058886195,0.04483366,0.016043417,-0.0065834895,-0.029475417,-0.028648037,-0.0007970806,0.020839637,0.0040205503,0.016896654,-0.029061727,0.020283742,-0.004964281,0.03187999,-0.022313409,0.01115024,0.0039332877,0.009850995,0.041575853,1.4543792e-05,0.008823234,-0.001180471,0.008448327,0.047522645,-0.0068452777,0.0055298726,0.02751039,-0.0034517266,0.017219849,0.026333958,0.0012216785,0.008079885,-0.009721717,0.021007698,0.040334783,-0.00069527404,-0.0012329903,-0.0065511703,-0.00937913,-0.009818675,0.00878445,0.004049638,0.01893925,0.044678528,-0.0075627714,0.01893925,0.0077825445,0.045712754,0.0058304444,0.03418114,-0.019210733,-0.013483711,-0.00022967071,0.013328577,-0.018370425,0.006289382,-0.03531879,-0.010678375,0.008086348,0.022520253,0.015409955,-0.0018179739,0.012022868,-0.015720222,0.017969662,-0.00813806,-0.041575853,0.040722616,0.025338518,-0.0005510481,-0.01993469,0.0003894504,-0.044445828,0.0033838556,-0.017504262,-0.00088232337,-0.025390228,0.04211882,-0.0068064947,0.024278436,0.021744585,-0.010594344,-0.034206998,0.004059334,0.024627486,0.011389405,0.031285312,-0.001119872,0.013302721,-0.024640415,0.027174266,-0.028260203,0.024937754,0.010225901,-0.0059726504,-0.017956736,0.01892632,0.00095989025,0.021343822,0.029682262,0.016082201,-0.018034302,-0.0136905555,0.015603872,-0.01224264,-0.039300557,0.0047929874,-0.0034387987,-0.027587956,-0.0009865538,-0.010658983,-0.0050580073,0.039972804,-0.01490577,-0.003138227,0.010626663,-0.0024078055,-0.023968168,0.021667017,-0.0070068757,-0.010775333,-0.0010301853,0.028699748,-0.0022801433,0.0051388065,0.015642656,-0.029010016,0.0018066621,0.0138069065,-0.008247945,0.008331977,-0.015707295,-0.005158198,0.024420641,-0.030923333,-0.034749966,-0.0060308254,-0.02502825,0.025842702,0.03632716,-0.0031075235,0.013496638,-0.0036036284,-0.029785685,0.01887461,0.028622182,0.0056106714,-0.03017352,-0.005226069,0.004951353,-0.008028173,0.015642656,-0.009443768,0.0038460249,-0.003616556,-0.015358244,0.0014398354,0.0032982088,0.063398,0.030328654,-0.01591414,-0.00076556904,0.007174937,-0.0096958615,0.032733228,-0.006211815,0.06510448,0.01005784,0.012520589,-0.0113312295,-0.017413767,0.028803172,0.035499778,0.0011933988,0.0056300634,-0.00017068755,0.007375318,-0.003212562,0.008745667,0.038240477,0.017685251,0.0026760576,0.0024045736,-0.0012798536,0.013302721,0.0061051603,0.012934279,0.03182828,0.0024271973,-0.012611084,0.017801601,-0.034232855,0.0011901669,-0.018202363,0.010187118,0.0072395764,-0.041782696,-0.006431588,0.008771522,0.033276197,0.051220004,-0.009301563,0.015590944,-0.0011303758,-0.02448528,-0.005132342,0.04780706,0.0005037808,0.030897478,0.017077643,-0.01632783,0.014155957,-0.0062473663,0.008790914,0.01893925,0.0033644638,0.045402486,0.0041078134,-0.0027810961,0.009456697,-0.008900801,-0.029604696,-0.026333958]
349f439d-1f2c-4d48-9088-3847da6c892e	e8cefc7b-5fbf-4ca9-bb62-c762005e9d6d	0	# Department Management Guide\n\n## Overview\nThe Department Master module allows administrators to organize users into logical departments, creating an organizational hierarchy for approval workflows, escalation paths, and reporting.\n\n## Accessing Department Management\n1. Navigate to **Master Data** in the sidebar\n2. Select the **Departments** tab\n3. View, create, edit or delete departments\n\n## Creating a Department\n\n### Required Fields\n- **Name**: The department name (e.g., "Sales", "Engineering", "Support")\n- **Description**: Optional description of the department's purpose\n\n### Optional Fields\n- **Manager**: Select a user as the department head\n  - Manager receives escalated items\n  - Manager can view all department activity\n  - Manager appears in approval workflows\n\n### Steps to Create\n1. Click **"Add Department"** button\n2. Enter department name\n3. Add optional description\n4. Select a manager from the user dropdown (optional)\n5. Click **Save**\n\n## Editing Departments\n1. Find the department in the list\n2. Click the **Edit** icon\n3. Modify fields as needed\n4. Click **Save**\n\nNote: Changing a department name or manager affects all users and records linked to that department.\n\n## Deleting Departments\n1. Click the **Delete** icon next to the department\n2. Confirm deletion\n\n**Important**: Departments with active users or linked records cannot be deleted. Reassign users first.\n\n## Department-User Relationship\n- Each user can belong to one primary department\n- Department assignment happens in User Master\n- Department filters are available in Reports and Lists\n\n## Use Cases\n\n### Organizational Structure\nCreate departments matching your company structure:\n- Sales → Sub-teams (Inside Sales, Field Sales)\n- Engineering → Implementation, Development\n- Support → L1, L2, L3 Support Teams\n\n### Approval Workflows\n- Department managers receive approval requests\n- Escalation paths follow department hierarchy\n- Reports can filter by department\n\n### Points System Integration\n- Point categories can be linked to departments\n- Department-specific performance tracking\n- Points leaderboards per department\n\n## Best Practices\n- Keep department names clear and consistent\n- Always assign a manager for approval workflows\n- Review department assignments quarterly\n- Use departments for reporting segmentation	en	580	{"endPosition": 2318, "startPosition": 0}	2025-12-01 18:53:07.649859	[-0.041780587,0.060894582,0.04298147,0.00942565,0.022979325,0.0052444646,-0.021228041,0.019902071,-0.028570918,0.01588663,0.02140317,-0.052688576,-0.033899818,-0.03615147,0.044207364,0.027144874,-0.011952501,-0.0025893957,0.016474562,0.065948285,0.061094727,0.049286082,0.041530404,0.027970478,-0.037102163,0.050587036,-0.0041061314,0.027320001,-0.015523866,-0.033949856,0.027945459,-0.01710002,-0.013209671,0.06609839,0.026869671,0.00072748575,-0.004891081,0.040054325,0.008762665,0.01901392,-0.01412284,0.009788416,-0.002536232,0.027470112,-0.044232383,0.019351669,-0.027219929,0.00041944772,0.026544433,0.027044801,-0.009456923,0.009356851,0.002447104,0.010038599,-0.008243536,0.028821101,-0.008706374,-0.010726604,-0.0060919602,-0.048885792,0.022466449,-0.049861506,-0.01961436,0.032623883,0.0069488375,-0.0185761,-0.0083873905,-0.0019420468,0.02914634,-0.0010734422,0.055090334,0.0046158796,0.01426044,-0.019626869,0.023429653,-0.041080076,-0.0022328848,0.040154397,-0.02317947,0.0057198126,-0.039253738,-0.007974588,-0.02332958,-0.011502171,-0.027244946,-0.009150449,0.0043500597,-0.010420129,-0.0024940134,-0.07715649,-0.033374436,-0.008593792,-0.03324934,0.047359675,-0.024768133,0.019251594,-0.024605514,0.0051662824,-0.01800068,0.021265568,0.009963545,-0.00876892,-0.0007188857,-0.043181613,0.03757751,-0.029796815,-0.05629121,0.011339552,0.0029615432,0.005979378,-0.12809378,-0.02421773,0.018325917,0.041780587,-0.002812997,-0.065648064,0.022028627,0.006629854,0.013710038,-0.037377365,-0.047835022,0.0070676743,0.010914241,-0.02453046,-0.023004342,0.028020514,-0.024417877,-0.045883592,-0.038728353,-0.027920442,0.022166228,-0.001412753,0.052838683,-0.061945353,-0.050587036,0.047134507,-0.039453886,0.04368198,0.0025628137,-0.04160546,0.030122053,-0.014385532,0.011489662,0.031272896,-0.04843546,-0.014935935,-0.008994085,0.04293143,-0.000100561905,0.027745314,-0.020114727,-0.034825496,-0.012596723,-0.082810625,0.052838683,-0.001615245,0.026094105,0.00017170774,0.022328848,-0.055840883,0.036877,0.015573902,0.0029271431,-0.03672689,0.0054258476,-0.022378884,-0.04936114,-0.0013814801,-0.03862828,0.014423059,-0.0386533,-0.05604103,-0.0022219392,-0.026694544,0.06494755,0.015336229,-0.051787917,-0.01992709,-0.007086438,-0.03922872,-0.0047691166,-0.009369359,-0.06464733,0.03077253,-0.025918975,0.0074429493,-0.034900554,0.0111519145,-0.013147125,0.05168784,0.040654764,0.027970478,-0.00706142,0.01471077,-0.024755625,0.029221393,0.022554012,-0.011583481,0.012409085,-0.015261173,0.00055900303,-0.027169893,0.05619114,-0.0133847995,-0.02319198,-0.01412284,-0.02347969,0.002834888,-0.037477437,-0.018976394,0.0130220335,-0.032949124,0.020865276,0.007536768,-0.05116246,-0.056991726,-0.06059436,0.010695331,0.0003082335,0.016311942,-0.017350202,-0.0017403367,0.021303097,-0.00794957,0.0018419735,0.01752533,0.029696742,-0.04826033,0.019076467,-0.02646938,-0.021453207,-0.03820297,-0.0012790614,0.022954306,-0.02081524,-0.035901286,0.010501439,0.018651156,-0.010920495,0.013072071,0.0077369143,0.020239819,0.018626137,0.023154452,0.0113458065,0.0112082055,-0.028270697,-0.049085937,0.059843812,0.02867099,0.049436193,-0.00900034,0.049085937,-0.038453154,0.01092675,-0.0502618,-0.046408977,0.0069676014,-0.012602977,0.01723762,-0.047960114,-0.009137941,-0.02018978,0.0019357923,0.0024752498,0.05959363,-0.0057948674,-0.04578352,-0.017662931,0.03625154,0.0072177844,0.017500313,0.008281062,0.030722493,-0.022566522,-0.050486963,0.026944727,0.013334762,-0.004759735,-0.027720295,0.02942154,0.0049723904,0.010520202,-0.0021687753,0.011470898,0.043757036,-0.009238013,0.036051393,0.0065235263,0.026619488,-0.033849783,0.06729927,-0.047835022,-0.011646027,-0.013747565,0.011983774,-0.01426044,0.011833664,0.013147125,0.009238013,-0.010801658,0.02644436,0.013422327,-0.0015378447,0.060544327,-0.0024627405,0.035150737,-0.05438982,0.0063421433,-0.023016851,0.0011969701,0.008018371,0.041655496,0.03357458,-0.019489268,-0.022241283,0.035475973,0.031598132,-0.004275005,-0.04403224,-0.0017262639,0.004396969,-0.02184099,-0.08246037,0.031448025,-0.02912132,0.008518737,0.0049942816,0.011933737,-0.040204436,0.04755982,0.02749513,-0.036801945,0.041755572,0.0067549455,0.010958022,0.034975607,0.08381136,-0.026269233,0.0071114567,-0.002196921,-0.030447291,-0.030447291,-0.02095284,-0.045883592,0.02290427,-0.04833539,0.016687218,0.028645972,0.0035244552,-0.04978645,0.0069613466,-0.0052100644,-0.028721027,-0.029296448,-0.0041436586,0.015661467,-0.045558356,-0.0025956503,-0.012121375,-0.058492824,-0.03437517,-0.010782895,-0.013660001,0.0050443183,0.012058829,-0.01255294,-0.017888097,-0.05021176,-0.0020311745,0.026169159,-0.023216998,-0.018150788,0.03610143,-0.041780587,-0.004212459,-0.0011547516,0.012834396,-0.007786951,0.04145535,0.047634874,0.011089369,0.016512088,-0.043331724,0.049461212,0.052138172,-0.019214068,0.02629425,-0.016687218,-0.04072982,0.008343609,-0.0065485444,0.021490734,0.0017090638,-0.0021234297,0.01636198,-0.02438035,0.0048785717,0.046584107,-0.019852035,0.011702318,0.011020568,-0.019139012,-0.009619542,0.0016558998,0.0013744438,-0.0060200323,0.0065297806,-0.017275147,-0.0591433,0.035776194,-0.04518308,0.010901731,0.011502171,-0.007987098,-0.021127969,-0.010889222,0.062195536,0.04488286,-0.03119784,-0.031372968,-0.005651012,0.019664397,-0.035475973,-0.022066155,0.029246412,-0.006051305,-0.014885899,-0.014085312,-0.035125718,-0.024342822,0.008368627,0.06549795,0.026069086,-0.062145498,0.024030093,0.034425203,-0.047309637,0.03167319,0.0023751764,0.03937883,0.0094193965,-0.00039091118,0.02214121,-0.0027191783,0.010645294,-0.013072071,-0.013334762,0.03122286,0.008124698,-0.005472757,0.06169517,0.021265568,-0.013072071,-0.037552495,0.040204436,0.028896155,0.011389589,0.014373023,0.020715166,0.035300843,0.05904323,-0.011864937,0.08110938,-0.021315606,-0.025456138,-0.04295645,-0.028045533,0.010194964,-0.00876892,0.071352236,0.03522579,0.016587144,-0.016399506,-0.0061044693,0.0011336425,-0.034825496,-0.032323666,-0.0011719518,-0.0074429493,0.028796082,-0.016487071,-0.015286191,0.01663718,0.05869297,0.055790845,0.0134973815,0.02869601,0.019426722,0.03705213,-0.03342447,0.012165156,0.06759949,-0.012402831,-0.027019782,-0.019676905,0.010689076,-0.030497327,-0.012496649,0.022854233,0.02584392,-0.025643775,0.016974928,0.0422059,0.046984397,0.0057198126,-0.017275147,2.3845583e-05,0.0035682374,0.012459122,-0.06799979,-0.021127969,0.0020217928,0.007092693,-0.013034543,-0.004828535,0.0055759572,0.017287657,0.026844654,0.0032367448,-0.017750496,-0.02421773,0.021665862,0.034099966,0.020314872,0.011464643,-0.0188513,-0.027545167,0.012015047,0.016437033,-0.0147232795,-0.0318233,0.005710431,0.0671992,-0.031272896,0.010320055,0.020477492,-0.0066048354,-0.011902465,0.0029380885,0.013609964,-0.0031194713,0.037202235,-0.006404689,0.0017293912,-0.0019748833,0.0065297806,0.013810111,0.033849783,0.022053646,0.007711896,-0.01033882,0.0047659893,0.0042906413,-0.010939259,0.039578978,-0.022491466,-0.039929233,0.0031053985,-0.03705213,0.0065110167,-0.037527476,0.021228041,0.0022657213,-0.025793884,-0.012984507,-0.0139977485,-0.023879983,-0.0023485944,-0.01263425,0.063196264,0.019639378,-0.01770046,-0.02719491,0.033074215,0.004140531,-0.025180936,-0.029471576,0.04250612,0.011183187,-0.02197859,-0.04413231,0.019076467,0.003002198,-0.010958022,-0.0105639845,-0.013722546,0.03017209,-0.021265568,-0.002672269,0.0001100415,0.010576493,0.020002143,0.0371522,-0.00898783,-0.0049598813,-0.00438446,0.014748298,0.026569452,-0.0010804785,0.0021421933,0.015661467,-0.022366375,-0.04710949,0.0016856091,-0.009106668,0.02274165,0.01501099,-0.0006629854,0.013359781,-0.010301292,-0.013059561,-0.024905734,-0.045258135,0.011939991,0.06224557,0.010914241,0.008237281,0.007874515,0.014948444,-0.0034994371,0.022178737,-0.007974588,-0.009369359,0.05994389,-0.013334762,-0.023742383,-0.029396523,0.0002126557,-0.016224379,-0.002970925,-0.04037956,0.05293876,-0.052838683,0.009431905,-0.020439964,-0.0011602244,0.024743116,0.018063225,0.009256777,0.057492092,0.008969067,0.042481102,0.0051787915,0.02451795,-0.008299827,0.0112895155,0.0051350095,-0.06659876,-0.017788023,-0.015361247,-0.019726943,0.035551026,0.00419995,0.035851248,0.0151986275,-0.023992566,0.009025358,0.018100752,0.03329938,-0.040954985,0.026669525,0.014247932,0.0004937208,0.040104363,-0.014285459,-0.04758484,-0.007611823,0.03254883,0.034825496,-0.061244838,0.026569452,0.012421594,0.005000536,-0.009994818,-0.039278757,-0.008337354,-0.03312425,0.024492932,0.04128022,0.021228041,-0.005754213,-0.005181919,0.015623938,0.003191399,-0.04828535,0.022191247,0.013747565,0.038578246,0.010870459,0.040929966,-0.029371504,0.013985239,-0.017925624,-0.0389285,0.011939991,0.0106202755,-0.010194964,0.0020812112,-0.12509158,-0.005375811,0.008612555,0.0021203023,-0.00050740276,0.008818957,-0.036601797,-0.03002198,0.003116344,0.039153665,-0.012027556,-0.012834396,-0.005047445,-0.023004342,-0.01725013,0.010701585,-0.009607034,-0.033799745,0.01263425,0.022041136,0.016437033,-0.027595203,0.033499528,-0.02899623,-0.0049817725,-0.018488536,-0.00083264086,-0.004572097,0.022041136,-0.014460587,-0.009982308,-0.014760807,0.033024177,0.0083999,-0.003324309,-0.020540038,0.019264104,-0.0045283153,0.0046064975,-0.011164424,0.026769599,-0.040954985,0.019902071,-0.040104363,0.01662467,-0.042431064,-0.02912132,0.019576833,0.029771797,-0.03525081,0.009456923,-0.005529048,0.010182455,-0.0056760306,-0.011333297,0.01664969,-0.015473829,-0.009269286,-0.0067737093,-0.009744634,0.035475973,0.029821834,0.041930698,-0.022766668,0.008994085,-0.025431119,-0.05183795,-0.0010632784,0.034675386,-0.030197108,0.02332958,0.00090456853,0.009019103,-0.0019529923,0.0048660627,0.00885023,-0.009938526,0.004309405,-0.00816848,-0.03600136,-0.018676173,-0.00450017,0.00202492,0.014735788,0.010169946,-0.0069863647,0.003921621,0.004694062,-0.047509782,0.007755678,-0.028595936,-0.01663718,0.0122965025,0.013559927,0.012446612,-0.040154397,0.010088637,0.016687218,-0.07660609,0.007711896,0.00063757616,-0.0061169784,0.016424526,0.021127969,0.066648796,0.013359781,0.04328169,-0.0233546,-0.011195697,-0.030097036,0.010301292,0.022328848,0.009344341,-0.037977803,-0.00353071,0.016562125,0.01025751,0.021353133,0.038428135,-0.012746832,-0.028921174,-0.027845386,0.008606301,-0.029171357,0.019814506,0.020127235,0.06479744,-0.023054378,-0.011789882,0.05544059,-0.027745314,-0.015573902,-0.008187244,0.040804874,0.0065110167,-0.0323737,0.020740185,-0.022854233,-0.0017372094,0.035000626,-0.0012384066,-0.012834396,0.008975321,0.007768187,-0.024480423,-0.0147232795,-0.03802784,0.022416411,-0.013647492,-0.008287317,0.020239819,0.014010257,0.021753427,-0.02987187,-0.035450954,-0.01887632,-0.0037246018,0.0067674546,0.018063225,0.035025645,0.014998481,0.0077244053,-0.013509891,0.017137546,-0.019526796,-0.015986705,-0.026719563,0.01708751,0.03895352,0.028771063,-0.010088637,0.037227254,0.0019295376,-0.0051975553,-0.009494451,0.0032867813,0.0056103575,-0.0130220335,0.004024822,-0.0018623009,0.012021301,0.0185761,0.03169821,0.0070489105,-0.029096302,0.021878518,-0.0057948674,0.009231759,0.011477153,-0.013972729,-0.0016715362,-0.0002949425,0.027970478,-0.01576154,-0.014435569,-0.004024822,0.029271431,-0.026694544,-0.007999606,0.006823746,0.012615486,-0.008668846,0.0058230134,0.0038371843,-0.0038840936,-0.05098733,-0.028195642,0.020915313,-0.004121768,0.012390321,-0.020377418,-0.007893279,-0.056891654,4.0068397e-05,0.011777372,0.05499026,-0.020840257,-0.026494397,-0.02749513,0.0017465912,-0.058042496,-0.010163691,0.00389973,-0.011358316,0.0010906423,0.01514859,0.0041499133,0.014160368,-0.0072115296,0.043782055,-0.02214121,0.023104416,-0.019076467,-0.014360514,0.025768867,0.021603316,0.014310477,-0.020039672,0.015686484,0.016737254,-0.01055773,0.0037715111,0.009926017,0.015286191,0.017375221,0.0129094515,-0.0520381,0.0118211545,-0.014047785,0.05529048,0.023054378,0.019902071,-0.047359675,0.024780642,-0.01902643,-0.044207364,0.035651103,-0.019714434,-0.026519416,0.007317858,0.019589342,-0.02691971,-0.0062577063,0.004559588,0.00818099,0.027395057,0.022278812,-0.01812577,-0.021140477,0.00779946,0.0024267768,0.033549562,0.0051350095,0.05293876,-0.0031976537,-0.017600385,-0.020314872,0.02050251,0.002997507,0.01738773,0.013134616,-0.018050715,0.03790275,0.002447104,-0.004187441,-0.030722493,0.015661467,6.972878e-05,-0.022128701,0.026419342,0.025768867,0.015786558,-0.029946925,0.025793884,0.010182455,0.006016905,0.0048003895,-0.0012094793,0.022679104,0.034900554,-0.0049223537,0.016537108,0.026394324,0.0006149033,0.002301685,0.0014831171,-0.005863668,0.029746778,0.004237477,0.008374882,0.006648618,0.005754213,0.0024048856,0.0035557284,0.0039497665,-0.03324934,0.0113458065,0.012646759,-0.039053593,-0.0060106507,-0.016699726,-0.027019782,0.003984167,-0.010026091,-0.010188709,-0.017775513,-0.042406045,0.023529727,-0.0026566326,0.014373023,0.00015773266,0.01121446,0.010301292,-0.0042218408,-0.0048879534,0.030197108,-0.007593059,-0.03167319,-0.012146393,0.02451795,-0.00030784257,-0.03445022,-0.015098554,-0.010057364,0.018963885,0.016249396,-0.013109598,-0.014510624,-0.0036964563,0.028195642,0.0153112095,-0.02319198,-0.0188513,0.007317858,0.00091864134,0.012871924,-0.0124341035,-0.0049848994,0.036751907,-0.0065172715,-0.01032631,-0.01144588,-0.009982308,-0.011614754,0.001395553,0.024192711,0.014923426,0.016299434,-0.015874121,0.0029396522,-0.02214121,-0.0071552387,-0.009019103,-0.003443146,-0.012809378,0.031122785,-0.028721027,-0.024605514,0.04072982,0.017888097,-0.006617345,0.021052914,0.011264497,-0.01159599,0.011602244,-0.017600385,0.008174735,-0.024292786,0.009863472,-0.0151986275,-0.011871192,0.010526457,0.0048316624,-0.02586894,-0.0009983872,-0.04325667,0.013772584,-0.008393645,-0.018963885,0.013334762,-0.008337354,0.018551081,0.04205579,-0.018613627,0.0053539197,-0.02764524,-0.016412016,0.003927876,-0.006016905,-0.013122107,-0.0034869278,0.0001789396,0.008481209,0.018388463,-0.0125466855,0.002803615,-0.018526064,0.0006708036,-0.01561143,0.02764524,0.026044067,0.0069676014,0.0003557292,-0.0041123857,0.033999894,-0.011833664,-0.032173555,-0.024305295,-0.018538572,0.014210404,-0.010820422,-0.012384066,-0.012221448,-0.006288979,-0.022203756,-0.013584946,0.017350202,-0.028220661,0.0219911,-0.0032867813,-0.02420522,0.004687807,0.03179828,0.012246466,0.045883592,-0.015323719,-0.025393592,0.033924837,0.06609839,0.01055773,-0.025068354,0.013309744,0.023166962,-0.009750889,-0.005472757,0.008268554,-0.005647885,-0.056941688,-0.011520935,-0.0018685556,0.0033555818,0.027420076,0.007980843,-0.022666594,-0.013059561,0.017162565,0.028771063,-6.4500346e-05,0.025043335,0.008105935,-0.020765202,0.0030819438,0.022791686,-0.017763006,0.032298647,-0.037127182,0.020602584,-0.03122286,-0.021465715,0.014060294,0.04037956,-0.023567254,-0.041880663,-0.01226523,0.015048518,-0.009319323,0.017212601,0.0014315168,-0.0029849978,-0.015336229,0.0202148,-0.0013760075,0.012052574,0.02734502,-0.023492198,-0.040179417,-0.001663718,-0.038978536,-0.015411283,0.010882968,0.029021248,-0.035450954,-0.028595936,0.009994818,-0.0043907147,0.044457547,-0.036676854,0.016724745,-0.021040404,0.04826033,0.024643041,0.003424382,-0.022691613,-0.0039028574,-0.005413338,-0.0038903481,-0.024017584,0.017575368,-0.021440698,0.0098947445,0.018488536,-0.023204489,0.022541502,0.04638396,0.013910184,-0.042481102,0.01663718,0.00605756,0.01100806,-0.032598868,-0.019651888,0.0024001948,-0.019151522,0.019952107,0.041580442,-0.023304561,-0.022716632,0.017187584,0.033524543,0.014022767,0.019088976,0.024555478,-9.562665e-05,0.0083999,0.00590745,0.024255257,1.1983871e-05,0.014548151,-0.003658929,-0.003943512,-0.026719563,0.028295716,-0.038177952,0.015261173,0.010151182,-0.007893279,0.019964617,-0.01812577,0.00965707,0.013972729,-0.014523133,0.0063358885,-0.0012305884,-0.002684778,-0.003446273,-0.0011727336,-0.0020061564,-0.041855644,0.006435962,0.008256044,-0.0011782063,0.004218714,-0.023229508,0.023867475,-0.012527922,-0.028445827,-0.0034368914,0.012984507,0.008875248,0.023642309,-0.020264836,-0.012046319,-0.043656964,0.04505799,0.01636198,0.007536768,0.044457547,0.0036902018,-0.04325667,0.009056631,0.0065422896,0.0125466855,-0.010038599,0.022228774,0.0041186404,0.030247144,0.002434595,0.0057823583,-0.013434836,-0.0076931324,0.0006950401,-0.046859305,-0.018250862,-0.057492092,0.008575028,0.0054289745,0.0072052754,-0.00046127522,-0.0076931324,-0.030072017,-0.04770993,-0.0053601745,-0.0010804785,-0.0021812846,0.010032345,0.020602584,0.017300166,-0.029796815,-0.0063233795,0.019051448,0.029796815,0.004415733,-0.024580495,-0.03339945,0.04921103,-0.023829946,-0.025943995,-0.022041136,-0.023267034,-0.013985239,-0.00605756,-0.001390862,0.010169946,0.025493665,-0.022466449,-0.016474562,0.01382262,0.040654764,0.002451795,0.010507693,0.008062152,0.0070551652,-0.0007118493,0.037377365,0.023980057,-0.023054378,0.017775513,-0.012515413,-0.0040560947,-0.026169159,-0.032148536,-0.00475348,0.0002724651,0.022554012,0.018713702,-0.0063421433,0.026594471,0.016662199,-0.028145606,-0.018038206,-0.012590468,0.028721027,-0.03374971,0.034275092,-0.00021930118,-0.0053070104,-0.021428188,-0.014285459,-0.015536374,-0.020477492,-0.006339016,-0.040029306,0.011639772,0.0071990206,0.013597455,-0.0030491073,0.055890918,-0.0024987045,0.013735056,-0.00064891257,-0.014385532,0.023992566,-0.012196429,0.0061294874,-0.007317858,0.0065923263,-0.005985632,-0.003072562,0.0050818454,0.0052976287,0.01591165,0.020840257,0.0099510355,-0.0101762,0.022378884,-0.001765355,-0.019176539,0.014960953,0.003952894,0.023692345,0.04695938,-0.004556461,-0.008881503,-0.023417145,-0.0007775224,0.0006637672,0.0072177844,0.03152308,-0.011370825,-0.036176484,-0.011652281,-0.015711503,-0.01722511,0.002131248,-0.017287657,0.003987294,-0.0124341035,-0.005991887,0.020277346,-0.0060731964,0.017275147,-0.0042812596,-0.014510624,0.018651156,0.030697474,0.00920674,0.022704123,-0.007524259,0.002517468,-0.011927483,0.0035995103,-0.018263372,-0.014610697,0.012459122,-0.016612163,0.031272896,0.03374971,0.0017637913,0.03775264,0.026169159,-0.0069676014,0.0065610535,0.003455655,-0.0006837037,-0.0037621295,0.02066513,0.016111797,-0.011064351,-0.022604048,-0.034099966,0.024255257,-0.030372236,0.013860147,0.014535642,0.019601852,0.0014448077,-0.0017106273,-0.014548151,0.007561786,-0.00028829701,-0.006329634,-0.048560552,0.0037965295,0.005225701,-0.013422327,-0.03179828,0.027094837,0.02170339,0.039253738,0.021715898,-0.007786951,-0.014022767,0.061444987,0.006479744,-0.030647438,-0.011552208,0.016311942,-0.02496828,0.023404635,0.032949124,0.014548151,0.021640845,-0.01055773,0.03357458,0.0003266063,0.013735056,0.017262638,0.004365696,-0.013247198,-0.007324112,0.022353865,0.040004287,0.003116344,0.0467092,0.02646938,0.012759342,-0.0038059114,0.0023298308,-0.010388856,0.006141997,-0.03757751,-0.003574492,-0.0065610535,-0.004437624,0.034675386,-0.01887632,0.01292196,-0.0024861952,-0.0154488105,0.007862006,-0.030872602,0.045083005,0.023992566,0.024943262,0.019827016,-0.046283886,-0.00758055,0.040529672,-0.00011825064,0.025793884,0.022941796,-0.027019782,-0.005084973,-0.0025190318,-0.022341358,0.051487695,0.00441886,-0.012846906,0.028045533,-0.014348005,-0.012152648,-0.0048879534,0.016974928,0.02214121,-0.006892546,0.0035682374,-0.009744634]
20016aa0-a630-406d-8d4c-202095982fd4	8b6acb9c-48c3-4046-88c8-8025302a095e	0	# Points System and Gamification Guide\n\n## Overview\nThe M-CRM Points System enables gamification of work activities. Users earn points for completing tasks, closing deals, resolving tickets, and other measurable activities. Points can be tracked by department for team-based competitions.\n\n## Accessing Points Management\n1. Navigate to **System Settings** in the sidebar\n2. Select **Points Management**\n3. View point categories, balances, and leaderboards\n\n## Point Categories\n\n### What Are Point Categories?\nPoint categories define the activities that earn points and their values. Each category is linked to a department and specifies how many points are awarded.\n\n### Creating Point Categories\n1. Click **"Add Category"** button\n2. Fill in the form:\n   - **Department**: Select the relevant department\n   - **Points**: Enter the point value (positive number)\n   - **Description**: Optional explanation\n   - **Active**: Toggle to enable/disable\n3. Click **Save**\n\n### Category Name Auto-Generation\nThe category name is automatically derived from the selected department:\n- Department "Sales" → Category name "Sales Points"\n- Department "Support" → Category name "Support Points"\n\nThis ensures consistency and prevents naming conflicts.\n\n## Point Earning\n\n### How Points Are Earned\nPoints are awarded automatically based on system events:\n- **Sales**: Lead conversion, quote acceptance, deal closure\n- **Implementation**: Module completion, training delivery\n- **Support**: Ticket resolution, customer satisfaction scores\n- **Tasks**: Task completion, on-time delivery\n\n### Assignment Events\nEach point award creates an assignment event record:\n- User who earned the points\n- Category that applies\n- Points awarded\n- Timestamp\n- Source activity (lead ID, ticket ID, etc.)\n\n## User Point Balances\n\n### Viewing Balances\nThe Points Management page shows:\n- **User Balances Tab**: Per-user point totals\n- Points by category\n- Recent point history\n\n### Balance Calculation\nUser balances are calculated from the sum of all assignment events:\n- Real-time totals\n- Historical tracking\n- Department aggregations\n\n## Department Configuration\n\n### Department-Specific Settings\nEach department can have customized point settings:\n- Different point multipliers\n- Category-specific rules\n- Department leaderboards\n\n### Linking Points to Departments\nWhen creating a point category:\n1. Select the Department dropdown\n2. Choose the appropriate department\n3. The backend automatically links the category\n\n## Leaderboards\n\n### Individual Leaderboards\n- Shows top point earners across the organization\n- Filtered by time period (weekly, monthly, all-time)\n- Displays rank, name, and points\n\n### Department Leaderboards\n- Aggregates points by department\n- Shows team performance\n- Enables healthy competition between teams\n\n## Best Practices\n\n### Setting Point Values\n- Balance point values across activities\n- Higher points for high-value activities (deal closure)\n- Lower points for routine tasks\n- Review and adjust quarterly\n\n### Fairness Considerations\n- Ensure points reflect actual value\n- Account for different job roles\n- Monitor for gaming behavior\n- Celebrate achievements publicly\n\n### Integration with Goals\n- Set monthly/quarterly point targets\n- Use points as one metric among many\n- Combine with qualitative feedback\n- Avoid purely point-driven culture\n\n## Technical Architecture	en	844	{"endPosition": 3377, "startPosition": 0}	2025-12-01 18:53:12.634671	[-0.017846804,0.051072516,0.054241817,0.021925332,0.0011454623,-0.018444296,-0.0031238403,-0.0020522526,0.008825986,0.011774475,0.037589997,-0.043980554,-0.034732427,-0.030705856,0.05522898,0.0075270915,-0.01422289,-0.010339197,-0.005481333,0.052215543,0.057307206,0.07393305,0.03140726,0.055125065,-0.03054999,0.027016997,-0.035511766,0.03436874,-0.026536407,-0.019470423,0.05104654,-0.01936651,-0.031173458,0.012047242,0.027042976,0.024834855,-0.013781266,0.06463297,0.015495807,0.028289914,-0.041045055,0.007819342,0.003477789,0.011871892,-0.04746159,-0.0055267946,-0.02906925,-0.010819788,0.013898167,0.0554368,-0.039200623,0.030627923,0.008306428,-0.023328139,0.019938024,-0.0033738774,-0.0076634753,-0.0074881245,-0.012105693,-0.021353818,0.023535961,-0.045357384,0.0060333633,0.0072088623,0.0144826695,-0.017483115,-0.044110443,0.004046055,-0.014573592,-0.011066577,0.061775405,0.030524012,0.03213464,-0.0014287835,0.042240035,-0.038057595,0.009767683,0.056268092,-0.016132265,-0.008494767,-0.004435723,-0.05177392,-0.03449863,-0.03166704,-0.011573146,-0.026653307,-0.032706153,-0.050708827,-0.028419804,0.0058450233,-0.035511766,-0.010404142,-0.0139501225,0.027042976,0.043409042,-0.046578344,-0.056839608,0.02600386,0.0077673867,0.013898167,0.024575077,-0.05922957,-0.010624954,-0.030030431,0.07746604,0.014041046,0.003880446,0.029303052,-0.044604022,-0.03766793,-0.08910414,0.01508016,-0.023574928,0.037745863,-0.010189824,-0.03361538,0.0031108514,-0.004818897,0.0023915889,-0.05091665,-0.023899652,0.055592667,0.00060479756,-0.06738663,-0.02709493,-0.002976091,0.009793662,-0.013638388,-0.02857567,-0.02295146,0.04317524,-0.0067282715,0.05000742,-0.026289616,-0.052942924,0.0034323276,-0.0004935798,0.017275292,-0.030601945,-0.02893936,0.040395606,-0.010982149,-0.013255214,0.0032050211,-0.05642396,-0.040135827,-0.009657278,0.017625993,-0.011670563,-0.0074751354,0.0018509241,-0.026432496,-0.0019288578,-0.026913086,0.03197877,-0.046162695,0.015729608,0.015482818,-0.031225415,-0.04738366,0.023509983,-0.013261708,0.010884733,-0.041772433,0.029458918,-0.009988496,-0.034888297,0.0006279341,-0.04683812,-0.0056924033,-0.035355896,-0.092792995,-0.055332888,0.001239632,0.01789876,-0.009540377,-0.013547465,-0.025692126,-0.01950939,0.02147072,-0.03959029,-0.0046987496,-0.049020264,-0.016418021,-9.619934e-05,0.021678543,-0.021016106,0.039408445,0.0118329255,0.0045331405,0.042032212,0.005150115,0.0020782305,0.013073369,-0.020561494,-0.018470274,0.01605433,-0.01840533,-0.014989238,-0.009891079,-0.011586135,-0.011410785,0.054657463,0.001206348,-0.02147072,-0.01814555,-0.0140280565,0.013534477,-0.06936094,-0.0024175667,0.012514845,-0.004588343,0.039668225,0.0030702609,-0.06691902,-0.026913086,-0.06172345,0.03496623,-0.0034615528,0.016288131,-0.019808136,0.02134083,0.00092546205,0.015469829,0.040655386,0.024341276,0.037745863,-0.04769539,0.049228087,-0.025250502,-0.01348252,-0.020743338,0.00717639,-0.016340088,-0.0042733615,0.010007979,0.022522824,0.021405775,0.012099199,-0.012371967,0.008754546,0.042447858,-0.011482224,-0.013911156,0.0721146,0.0050137313,-0.04008387,-0.03738217,0.039798114,0.0026432495,0.05052698,-0.008812997,0.031225415,0.026991019,0.0051988238,-0.048370816,-0.02097714,0.051202405,-0.003575206,-0.029770654,-0.03816151,-0.027510578,-0.07455652,-0.0221981,-0.00010061356,0.0139501225,-0.04782528,-0.01159263,-0.018340385,-0.03507014,-0.014950271,0.019002821,0.016521933,0.018743042,0.013281193,-0.04073332,-0.010884733,0.020080904,-0.0009822886,-0.045175537,0.0008986724,-0.03603132,0.058606103,0.0040330663,0.0304201,0.0055300416,-0.013053886,0.021678543,0.013430565,-0.00032391172,-0.06442515,0.028549692,-0.048007127,0.0014474551,-0.0073777186,0.035511766,-0.025484303,0.0038836934,-0.006215208,0.0018103337,0.030498033,0.0075530694,-0.016534923,-0.010598976,0.02317227,-0.02379574,0.040187784,-0.02417242,-0.002105832,-0.010007979,0.001876902,-0.004513657,0.058034588,0.0055267946,-0.037356194,0.017638981,0.060164776,-0.0020928432,0.018859942,-0.03849922,0.00091003766,0.011358829,-0.00030686375,-0.009105247,0.048266906,-0.029406963,0.003740815,0.0006254987,0.018665109,-0.034316782,0.05091665,0.0054683443,-0.017483115,0.04987753,-0.04808506,0.009936539,0.013560454,0.06556817,-0.038655087,0.0022941716,-0.029121205,-0.0684777,-0.038577154,-0.0416945,-0.0071179396,-0.005549525,-0.011936837,0.012482372,0.04603281,-0.0050137313,-0.044318266,-0.022704668,0.023847695,0.018613152,-0.036135234,-0.009423477,-0.008241483,-0.043253172,-0.03836933,-0.014677503,-0.051929787,-0.02821198,-0.023354117,-0.028601648,-0.004419487,0.022509836,-0.040317673,-0.009657278,-0.003409597,-0.006890633,0.018911898,-0.0022016256,-0.038473245,0.015028205,-0.018820975,0.037979662,0.026887108,0.019132711,-0.013872189,-0.0028104822,0.060164776,-0.019353522,-0.0054326244,-0.02024976,0.025367402,0.04198026,0.032030728,-0.0060560936,-0.076219104,0.0015505549,0.0051695984,-0.0120602315,-0.02857567,-0.021158986,0.029277073,0.063489944,0.019652268,0.007618014,0.050734803,-0.02134083,-0.016469978,0.007631003,-0.035381876,-0.028523715,0.008384362,-0.043694798,-0.024847845,0.018652119,-0.028991316,-0.0012453147,0.013170786,-0.0042701145,0.018093595,-0.0012363849,0.034784384,-0.02465301,-0.0121316705,0.043486975,-0.005146868,-0.0013151303,-0.031485192,-0.02504268,0.020587472,-0.00068354304,-0.02893936,0.037122395,-0.007715431,0.014080012,0.007247829,-0.010722371,-0.023600906,0.021938322,0.044837825,0.009358532,-0.051670007,0.015262006,0.035771545,-0.011884881,0.011443257,0.000326956,0.010105396,-0.0301863,-0.044474132,0.026575373,-0.0012769753,-0.010871744,-0.013112336,-0.035979368,0.03655088,-0.0006222515,-0.050682846,0.07050397,0.028991316,0.009982001,-0.040447563,0.026068805,0.083856605,0.020548504,-0.0015473076,0.037693907,0.014209902,0.04564314,0.037693907,0.056268092,0.007111445,-0.016625844,-0.024678988,0.0071179396,-0.016262155,-0.01618422,0.032732133,-0.0072543235,0.018080605,0.027900245,0.009144215,-0.024315298,-0.014976249,-0.0011649457,0.019028798,-0.0023656108,0.008923402,-0.013625399,-0.03236844,0.02084725,0.043149263,0.031511173,0.058917835,0.011508202,-0.032706153,0.04600683,-0.019080754,-0.026471462,0.04133081,-0.014261858,-0.0054033995,-0.046266608,0.044759892,-0.04564314,-0.0005455355,0.0097482,0.003435575,-0.009936539,-0.023354117,0.05270912,0.016353076,0.0029744676,0.013846211,0.0018801492,-0.047279745,0.01753507,-0.064061455,-0.028627627,-0.030108366,0.011703036,-0.01570363,-0.002739043,-0.004390262,-0.0036336563,0.039408445,0.009157203,-0.0023721054,0.0068971277,-0.024029542,0.021626586,0.0018038392,-0.0018460533,-0.027198842,-0.009592333,-0.029718697,-0.017807838,-0.022029243,-0.004377273,0.01509315,0.03569361,-0.07175091,0.054605506,-0.02341906,0.0013727687,0.013326653,0.0035557225,0.018950865,-0.03177095,0.050864693,-0.0035979366,0.0095663555,-0.019444445,0.00622495,0.017833816,0.013157797,-0.01570363,-0.015664663,-0.027900245,-0.02318526,0.006695799,0.0054488606,-0.011449751,-0.011417279,-0.043590885,-0.00081505603,-0.0051273843,0.009020819,-0.046552364,0.022392934,0.020886216,-0.046890076,-0.023380093,0.030965636,-0.026302606,0.0018704075,0.020171825,0.031511173,-0.009917056,-0.008520746,-0.016989535,0.011988793,-0.0025880465,-0.016495954,-0.021613598,0.056372005,0.008040154,-0.043486975,-0.0042051696,0.016651822,-0.0002861626,0.007546575,0.025055667,-0.015041194,0.0034031025,0.033251688,0.011579641,0.0059716655,-0.006955578,-0.0025360908,0.036369033,-0.02024976,0.02919914,-0.0194964,0.02084725,-0.003825243,0.016625844,0.03197877,-0.014196913,-0.03332962,-0.044941735,0.0022048727,0.012436911,-0.019444445,0.056008313,-0.007981705,-0.0012761635,-0.0015846508,0.014651526,0.007247829,-0.0022616994,0.0075530694,0.017210348,0.009072775,0.008351889,0.034732427,-0.020938173,-0.012988941,0.03532992,-0.0047507053,-0.0017583779,0.02575707,0.007189379,-0.01863913,-0.034758408,-0.0047571994,0.008449306,0.0069750613,-0.0022389686,0.03836933,-0.0058612595,0.009598827,0.009014325,0.010131374,-0.003239117,0.038914867,-0.03177095,0.035849478,0.031095525,0.018353373,0.012423922,0.029225117,-0.013534477,0.0027081943,0.035563722,-0.073569365,-0.008793513,-0.017041491,-0.019691234,0.044630002,-0.022899503,0.01252134,-0.03753804,-0.008254472,-0.012274549,0.010274252,-0.000590185,-0.07616715,-0.00010563662,-0.030731834,0.0014653149,0.02526349,0.031199437,-0.021353818,0.019002821,-0.00968975,0.037615974,-0.07606324,0.049409933,-0.0056144698,0.03361538,0.008592185,0.013222742,0.023029393,-0.030887702,0.004718233,0.043720774,-0.0082025165,-0.013638388,-0.039434426,-0.008929897,0.010508053,-0.037719883,-0.0009741706,0.016859645,0.057618942,0.027458621,0.033563424,0.0010171965,0.00035638406,-0.0167947,0.00094819267,0.0076439916,0.024276331,0.00377004,0.009098753,-0.14059229,-0.009663772,-0.0045363875,-0.008851963,-0.018301418,-0.02574408,-0.011462741,0.009371521,-0.0030735082,0.0042538783,-0.031095525,-0.025562236,-0.020340681,-0.020652417,0.0027861279,-0.016820678,0.024029542,-0.037486084,0.012975952,0.03468047,-0.017768871,-0.020041935,0.06281452,-0.007890781,0.0030588957,0.0077479035,-0.005049451,-0.009163698,0.020808283,-0.02561419,0.021743488,-0.032472353,0.0050039897,0.04442218,0.01875603,-0.030238254,0.017768871,-0.0023964597,-0.009040303,-0.040057894,0.018820975,-0.044500113,-0.0111510055,-0.026172716,-0.022263044,0.01018333,-0.0031904087,0.010767832,0.008027165,0.013391598,0.015300972,0.016586877,0.01079381,0.009040303,0.009585839,0.035018183,0.014157945,-0.0075270915,-0.019964002,0.0056924033,0.018366363,-0.020652417,0.05704743,0.0011154253,0.016950568,0.0056859087,-0.043954577,0.021678543,0.019041788,-0.0037375677,-0.0024289319,0.003847974,0.01282658,-0.009313071,-0.044915758,0.02318526,-0.02099013,0.005871001,0.013183775,-0.031199437,-0.005783326,0.017483115,-0.014846359,-0.0029825857,-0.03299191,-0.008520746,-0.029952498,-0.005981407,-0.03888889,-0.010878238,-0.024328286,-0.040057894,0.012605768,0.020288726,-0.0038642099,-0.003796018,0.028160024,0.031848885,-0.08099904,-0.005023473,0.021678543,-0.029952498,0.023626884,0.012878535,0.022769613,0.0050754286,0.039668225,-0.01654791,0.016781712,-0.010254769,0.006650338,0.012936985,0.021730497,-0.03938247,-0.022003267,0.01975618,0.0070075337,0.013274698,0.035407852,-0.009014325,0.029329028,-0.012358977,-0.029380985,-0.0081310775,0.0016236176,0.02514659,0.039434426,-0.025120612,0.0070140283,0.049747646,-0.014820382,-0.01840533,-0.009904068,0.065152526,0.009403993,-0.0033641357,0.0155347735,0.012911008,0.04133081,0.015028205,0.0059716655,-0.0058450233,0.045695096,-0.042967416,0.015508795,0.02979663,-0.046448454,0.015417873,0.0047669415,-0.016028354,-0.007566058,-0.01178097,0.023003414,-0.02318526,-0.037122395,-0.005133879,0.011449751,0.0038057598,0.0060560936,-0.0074296743,0.013768277,-0.04608476,-0.02539338,0.021860387,0.01275514,-0.010780821,-0.027640466,0.015521784,0.014170934,0.0034031025,-0.005523547,0.012553811,-0.040655386,0.0048611113,0.0055267946,-0.016327098,0.003545981,0.032212574,0.037875753,-0.027822312,0.009676761,0.043798707,0.007111445,0.019210644,0.010553515,-0.0004493362,0.0008296686,0.020574482,0.026653307,-0.024146441,0.0040070885,-0.004000594,0.035615675,-0.026406517,0.02269168,0.029458918,0.0143268015,-0.003367383,0.021068063,-0.016612856,-0.00083372765,0.047773324,-0.038603134,0.039798114,-0.021730497,-0.026835153,-0.030316189,-0.0015408131,0.004266867,0.024990723,-0.03481036,0.03997996,-0.04356491,0.007195873,0.024250353,0.048162993,0.008481778,-0.0069360947,-0.009637794,-0.014677503,-0.041122988,0.022289023,0.007877793,0.053254656,-0.0030540247,0.02379574,0.014586581,-0.006543179,0.01024178,0.015768575,-0.03029021,0.03387516,-0.051540118,0.0063710758,0.014430714,-0.0044941735,-0.014067023,-0.010865249,0.017950717,0.049513843,0.0135734435,-0.013339642,-0.0010171965,-0.0026773454,-0.0067997104,-0.0061600055,-0.014093001,0.006500965,0.011196467,-0.0034875306,-0.0037732874,0.020054925,-0.026835153,0.029562829,-0.017859794,-0.069205076,0.0010115138,-0.0034875306,-0.015274995,0.03766793,-0.011644586,-0.016275143,0.014067023,-0.00955986,-0.022652714,0.021847399,0.02048356,0.0055170525,-0.0019223633,-0.00044974207,0.024341276,0.030705856,-0.0017778613,0.020041935,0.04499369,-0.025419358,-0.025198545,0.0080531435,-0.0382914,0.021197952,-0.009176686,-0.0035589698,0.02561419,0.019886069,-0.0147814145,-0.021548653,0.0037018482,0.027146887,0.0056859087,0.004266867,0.022899503,0.035849478,-0.054241817,0.028471759,-0.0066828104,0.0274846,-0.014287835,0.001919116,-0.0031043568,0.0063580866,-0.005754101,0.007040006,0.031848885,0.027068954,-0.018353373,0.0054683443,0.012157649,-0.0022649467,0.0147814145,0.0248998,-0.036524903,0.011047094,-0.027042976,-6.697423e-05,-0.004046055,-0.055852447,0.013924145,-0.03322571,-0.017327247,0.007306279,-0.030939657,0.014729459,0.02024976,-0.0058580125,-0.0016171231,0.029173162,-0.0028478254,0.02134083,-0.043746755,0.044604022,-0.0097482,-0.024821866,0.010345692,-0.019938024,0.018171528,0.020288726,0.011267906,-0.025250502,0.018496253,0.009293587,-0.0108457655,-0.023821717,-0.015495807,-0.006656832,0.016599867,0.036369033,-0.04660432,0.016093299,0.00401683,0.008176538,0.029380985,-0.024549099,0.020925185,0.025211535,-0.02906925,0.00858569,0.03322571,-0.027406666,0.0041597085,-0.018327396,0.021873377,-0.016690789,-0.043954577,-0.014885327,-0.02036666,-0.00084103394,0.00030544307,0.0009692997,-0.022587769,-0.011196467,-0.018730054,0.010748349,0.017768871,-0.0065366845,-0.0036531396,-0.027146887,-0.041668523,-0.034394715,-0.009215654,0.015404884,-0.009001336,0.0012412557,0.015236028,0.0038219958,-0.009072775,-0.017327247,0.023977585,0.0072932905,0.010443108,-0.024250353,0.009975507,0.00687115,0.011053589,-0.008748052,-0.020535516,-0.022029243,0.009150709,-0.006387312,0.024068508,-0.034186892,0.012807095,0.019327544,0.0055819973,0.010111891,0.009923551,-0.007455652,-0.0061600055,-0.0006802958,-0.01814555,-0.020665405,-0.02722482,-0.013807245,0.027172865,-0.016366066,-0.020795295,-0.01666481,-0.021366809,0.02844578,0.0060398574,0.03444667,0.024860833,-5.5761117e-05,0.0010253146,0.004020077,0.031511173,-0.020418616,-0.01740518,-0.00321801,-0.019028798,0.01717138,0.0074036964,0.009196171,-0.026081793,0.011261412,0.0018622894,-0.028341869,-0.006211961,-0.010949677,0.01975618,0.00981964,-0.011027611,-0.022626735,0.02430231,0.016651822,0.0015018464,-0.0066016293,-0.0054910746,0.019938024,0.07362132,0.030653901,0.0031433238,0.0355897,0.024691977,0.011326357,0.002505242,-0.005760595,-0.016262155,-0.027666444,-0.024146441,0.011936837,0.008364878,-0.0029971981,-0.012105693,-0.04023974,-0.033511467,0.009241631,0.0037115898,-0.004107753,0.02636755,-0.025471313,0.020678394,0.0042863507,0.016469978,-0.013716321,0.024146441,-0.012969458,0.011917354,-0.025835004,-0.015443851,-0.0056144698,0.02587397,0.001787603,-0.005176093,0.011027611,-0.0045558712,0.039434426,0.033823203,0.0017259056,0.004192181,-0.014300824,0.024873823,-0.026913086,0.005744359,0.023522973,-0.016963556,-0.0077543976,0.011703036,-0.04182439,-0.008066133,-0.004068786,0.007494619,-0.02649744,0.00870259,0.02330216,-0.009345543,0.039096713,-0.008559712,0.024133453,-0.019431455,0.016106287,0.0122096045,0.022509836,-0.028861428,-0.0012712926,-0.025796037,-0.024938766,0.0069945445,-0.003575206,-0.06011282,0.018665109,0.0031563127,0.0033771247,-0.014080012,-0.034524605,-0.014067023,-0.008845469,-0.0089623695,0.003890188,0.008631151,0.0081310775,-0.006517201,0.0113068735,-0.040265717,0.003948638,0.025497291,-0.018301418,-0.048422772,0.024068508,0.018431308,0.027978178,-0.015417873,0.008670118,-0.009793662,8.376852e-05,0.00118037,0.022159133,-0.011391302,0.0026789692,-0.005088418,-0.031225415,0.022276035,0.032784086,-0.03657686,0.008351889,0.04587694,-0.033797223,0.034472648,-0.00093520375,0.016444,0.005715134,-0.026289616,0.008007682,-0.011196467,0.01728828,-0.014287835,0.022496846,-0.013664366,-0.022457879,0.015067171,-0.015106139,0.015911452,0.013963112,0.013716321,0.015002226,-0.012690196,-0.017574036,-0.010995138,0.0028104822,-0.009761189,0.041148964,-0.026016848,-0.013521488,-0.023925629,0.032212574,0.013690344,0.0063808174,0.005864507,0.02365286,-0.03410896,0.015508795,0.004046055,0.02404253,-0.028419804,0.010858755,0.009663772,-0.00180871,-0.0038122542,0.013326653,-0.021990277,-0.009527388,0.042603727,-0.0029160173,-0.01654791,-0.044837825,0.005939193,-0.018691085,0.010878238,0.010521042,-0.018691085,-0.054501597,-0.015651673,-0.015560752,-0.0050981594,-0.016015364,0.003825243,0.026458472,-0.008754546,-0.006500965,-0.02391264,0.0072023678,-0.00068354304,-0.011852409,-0.008247977,-0.017392192,0.0033966082,0.0056436947,-0.02010688,0.0045558712,-0.019976992,-0.012242077,0.0066893045,-0.0011243552,0.039226603,-0.019288577,-0.02295146,-0.010215802,0.022886515,0.041122988,-0.0011316615,-0.013521488,0.00870259,0.012488867,0.039304536,0.032316484,0.021639576,0.025224524,0.009436466,0.02086024,-0.0072023678,-0.0036791177,-0.04304535,0.0021155737,-0.014430714,0.0013110712,0.020431604,-0.026471462,-0.00567292,0.032420397,-0.01079381,0.018392341,0.021795442,0.04738366,-0.039226603,0.03423885,-0.0030978625,0.0022113672,0.0006246869,-0.004276609,-0.0086571295,-0.008683107,-0.004890336,-0.06203518,0.005192329,-0.014521636,0.016625844,0.0041467194,0.015417873,-0.019093743,0.03434276,-0.008325911,-0.032602243,0.044214357,0.007546575,-6.398068e-05,-0.008442812,-0.024678988,-0.040317673,0.019106733,-0.024341276,-0.02341906,0.011514696,-0.007384213,0.004042808,0.015989386,0.04096712,-0.00809211,0.0015400014,-0.011767981,0.02108105,0.017340235,0.04060343,-0.0074231797,-0.014677503,-0.037564017,0.0274846,-0.0054910746,0.011391302,-0.005851518,-0.026302606,-0.0128135905,0.009761189,-0.010384658,0.013138314,0.024237365,-0.03187486,-0.014820382,-0.040785275,-0.009871596,0.010098902,0.015599718,0.013872189,-0.03101759,-0.0031189695,0.008273955,0.022302011,-0.025588214,-0.0009928421,-0.019353522,-0.019678246,0.013820233,-0.016898612,-0.009131226,0.0073517407,-0.017690938,0.005104654,0.03836933,0.04881244,0.019976992,0.031900838,0.0010594105,-0.015119127,-0.019613301,-0.023367105,-0.0059456876,-0.008351889,0.0113068735,-0.0006758308,0.015145105,0.0011543921,-0.017742893,0.026679285,-0.022418913,0.04613672,0.023211237,0.029848587,0.03681066,-0.025497291,-0.017327247,0.02048356,0.0043805204,-0.0032407409,-0.032082684,0.0156127075,-0.0020733597,-0.009241631,-0.020327693,0.0025117365,-0.0022893008,0.0029728438,-0.0032407409,0.004611074,0.010482076,0.032186598,0.02415943,-0.015768575,-0.0017210346,-0.007592036,-0.039824095,0.027536554,0.007345246,0.014417725,-0.00038418852,-0.016495954,0.0053222184,0.004611074,0.018924886,0.03345951,-0.0069490834,0.013092852,0.008605174,-0.007955726,0.02369183,0.013885178,0.009988496,0.03509612,0.0073582353,0.007631003,0.012898019,0.014755437,-0.006569157,-0.009085764,0.04333111,0.0062022195,0.019275589,0.004994248,-0.022405922,0.010287241,-0.013144808,-0.0030377887,-0.019717213,-0.011560158,0.0077219256,0.015391896,0.0128135905,0.016353076,-0.05408595,0.018340385,0.0008377867,0.01666481,0.00090679043,0.019704223,-0.020782305,-0.003932402,0.005695651,-0.023354117,0.03444667,-0.021678543,-0.009533883,0.0034583055,-0.000785425,0.016301122,0.0037180844,0.023925629,-0.015482818,-0.0067867218,-0.008722074,-0.010209308]
e5b05e05-0936-43a4-97fa-80e332d49488	8b6acb9c-48c3-4046-88c8-8025302a095e	1	ation\n- Filtered by time period (weekly, monthly, all-time)\n- Displays rank, name, and points\n\n### Department Leaderboards\n- Aggregates points by department\n- Shows team performance\n- Enables healthy competition between teams\n\n## Best Practices\n\n### Setting Point Values\n- Balance point values across activities\n- Higher points for high-value activities (deal closure)\n- Lower points for routine tasks\n- Review and adjust quarterly\n\n### Fairness Considerations\n- Ensure points reflect actual value\n- Account for different job roles\n- Monitor for gaming behavior\n- Celebrate achievements publicly\n\n### Integration with Goals\n- Set monthly/quarterly point targets\n- Use points as one metric among many\n- Combine with qualitative feedback\n- Avoid purely point-driven culture\n\n## Technical Architecture\n\n### Database Tables\nThe points system uses five interconnected tables:\n1. **point_categories**: Defines earning activities\n2. **point_category_department_settings**: Department customizations\n3. **assignment_events**: Individual point awards\n4. **user_point_ledger**: Transaction history\n5. **user_point_balances**: Cached totals for performance\n\n### API Endpoints\n- `GET /api/point-categories` - List all categories\n- `POST /api/point-categories` - Create new category\n- `PATCH /api/point-categories/:id` - Update category\n- `DELETE /api/point-categories/:id` - Delete category\n- `GET /api/points/user/:userId/balance` - User balance\n\n## Troubleshooting\n\n### Points Not Appearing\n1. Check if the category is active\n2. Verify user is in correct department\n3. Confirm the triggering activity completed\n\n### Balance Discrepancies\n1. Review assignment events history\n2. Check for duplicate entries\n3. Verify category point values	en	432	{"endPosition": 4303, "startPosition": 2577}	2025-12-01 18:53:12.634671	[-0.03325847,0.026021022,0.0493104,0.013066834,0.022500863,-0.013045712,-0.028513296,0.011581326,0.026879942,0.023275297,0.06032146,-0.038243018,-0.04911327,-0.038834404,0.08223093,0.030048085,-0.031765923,-0.0018128824,-0.039482113,0.07012159,0.042608015,0.04381895,0.046297144,0.04089018,-0.017206542,0.024176458,-0.006667183,0.009272101,-0.019839622,-0.0338217,0.04466379,-0.015361978,-0.026288554,0.031963054,0.033737212,0.025485959,-0.0021824993,0.055646688,0.03368089,-0.0006692704,0.00094252283,0.0053365626,0.003805293,-0.017107977,-0.036299888,-0.008025965,-0.021515219,-0.021275846,0.022261491,0.039369468,-0.044100564,0.04790234,-0.0039108978,-0.021909475,0.05829385,0.012728899,-0.023007765,-0.0070332796,-0.009110174,-0.025781652,0.017713444,-0.014897317,-0.002245862,0.017854251,0.019543927,-0.013489253,-0.0493104,0.0037313695,-0.0034831984,-0.004005942,0.06415139,0.041453402,0.0250917,-0.006857272,0.062405396,-0.039848212,-0.0029833356,0.045367822,-0.016798204,-0.022627588,-0.010222545,-0.02682362,-0.03061131,-0.0057167397,0.016882688,-0.03601828,-0.037567146,-0.048521884,-0.018741332,-0.011961504,-0.017910574,0.0011845338,-0.0021455374,-0.0095607545,0.03917234,-0.04798682,-0.0075542633,0.03303318,0.0055090506,0.01982554,-0.0032596681,-0.06386978,-0.013756786,-0.014369293,0.060772043,0.017220622,-0.0032878295,0.044776436,-0.02024796,-0.026809538,-0.08178036,0.014059518,-0.045480467,-0.0026964424,-0.004048184,-0.015756236,-0.0016826364,0.0009706841,0.03016073,-0.0501834,-0.026795458,0.04052408,0.013066834,-0.026753215,-0.030667633,-0.008934166,0.0107505685,-0.014327051,-0.049028788,-0.05043685,0.055393238,0.0018621646,0.060434107,-0.02638712,-0.052971367,0.005980752,-0.0027633256,0.0092369,-0.035342406,-0.026767297,0.03185041,0.015798477,0.01872725,0.004910623,-0.044354014,-0.015488704,-0.013707503,0.025204346,0.002684122,-0.0006045875,0.0077161905,-0.008913045,0.007223368,-0.025500039,0.015249333,-0.031963054,0.03351192,0.022191089,-0.06026514,-0.046071853,0.012531769,0.0031751844,-0.008265335,-0.027837425,-0.00198009,0.001211815,-0.04122811,-0.023345701,-0.072092876,-0.017868333,-0.028189441,-0.0928759,-0.031118214,0.011574286,0.033624567,-0.0046958933,-0.0019959307,-0.032667086,-0.010384472,-0.02706299,-0.02795007,-0.014474898,-0.039228663,-0.004386119,0.0079485215,0.05483001,-0.022134766,0.059701912,0.029907279,0.020768944,0.030977407,0.031737763,0.03435676,0.0011537324,-0.025457798,-0.028921634,-0.0037102485,1.5366323e-06,-0.017600799,0.015742155,-0.024317265,-0.025992861,0.039087854,0.003499039,-0.026471604,-0.017037574,0.0056920988,0.0057801027,-0.042354565,-0.02838657,0.0043896395,0.009328424,0.03328663,-0.004224192,-0.036891278,-0.0041080266,-0.08944023,0.033371117,-0.022050282,0.014615704,-0.03210386,0.046297144,0.015728075,0.01651659,0.048775338,0.029513022,0.08054126,-0.011151867,0.035145275,-0.03939763,0.013271003,-0.017755687,-0.01916375,-0.022162927,-0.002925253,0.019191911,0.017262865,-0.00040657847,0.013728624,0.016882688,-0.013587818,0.017600799,-0.01540422,0.014643866,0.03461021,0.011574286,-0.0193468,-0.009588916,0.054323107,0.013144277,0.02820352,-0.035708502,0.0045058047,0.011095544,0.018966623,-0.050943755,-0.024007492,0.04483276,-0.0019308077,-0.030442344,-0.031512473,0.002995656,-0.07609178,-0.021501137,-0.031287182,0.051084563,-0.01254585,-0.019473525,-0.03190673,-0.025204346,-0.010511198,0.050127078,0.033709053,0.00083735806,0.009525552,-0.007723231,-0.016798204,0.033568244,-0.0019783298,-0.06358817,-0.024317265,-0.013946874,0.04074937,0.009398827,0.03877808,0.0096874805,-0.04001718,0.019248234,0.033709053,0.021881314,-0.031174537,0.03742634,-0.03697576,0.016967172,0.0033142306,0.056913946,-0.0045726877,0.002684122,-0.010187343,-0.028696343,0.007793634,-0.00061734807,-0.02531699,-0.010483037,0.049366724,-0.019177832,0.04815579,0.00050514296,-0.0022353015,-0.015685832,0.012940108,0.017840171,0.050915595,0.0071635256,-0.039482113,0.004361478,0.035539534,0.041002825,0.005681538,-0.016967172,-0.005699139,-0.018586444,0.021374412,0.027133392,0.04153789,-0.029428538,0.03807405,-0.01189814,0.00616732,-0.033934344,0.04159421,0.020980153,-0.048099466,0.09681848,-0.016263139,-0.008877844,0.024570717,0.047677048,-0.018558282,0.03939763,-0.037651632,-0.05829385,-0.046804048,-0.017727526,-0.025176184,0.022641668,0.021444814,0.0130386725,0.009546674,-0.0035183998,-0.051084563,-0.021839073,0.018516041,-0.012968269,-0.033709053,-0.050718464,-0.01079985,-0.05480185,-0.05102824,0.004386119,-0.049789142,-0.021472976,0.0026542007,-0.034835503,0.016136413,0.025190264,-0.045621272,-0.039031535,-0.0047381353,-0.026161829,0.017009413,0.014840994,-0.015291574,0.021149121,-0.037060246,0.045508627,0.037764277,0.04686037,-0.006089877,0.06274333,0.046719562,-0.015939284,0.0091383355,-0.004667732,0.040608566,0.055111624,0.021163201,0.011701012,-0.08110449,0.01561543,0.005033829,-0.017502235,-0.010102859,-0.039453954,0.03852463,0.035680342,0.002245862,0.023880765,0.069389395,-0.0055548125,-0.022557184,0.011489802,-0.060039848,-0.03720105,0.0052027963,-0.01363006,0.005149994,0.023655474,-0.0034691177,-0.01758672,0.02772478,-0.012355762,0.026133668,-0.010377431,0.026358958,-0.03627173,-0.009715642,0.028259844,0.008370941,-0.021444814,-0.021064637,-0.04153789,0.030583149,-0.036468856,-0.053759884,0.01806546,0.010468956,-0.004111547,0.012229036,-0.025162103,-0.061729524,0.026344877,0.03829934,0.00880744,-0.038271178,-0.0063046063,0.046719562,-0.0052098366,0.031146375,0.03351192,0.007568344,-0.026232231,-0.05697027,0.027893748,-0.026612408,-0.028090876,0.011236351,-0.0470575,0.043086756,-0.006691824,-0.01738959,0.047564402,-0.0036187244,0.021698266,-0.01584072,0.017276945,0.05263343,0.030217053,0.02355691,0.039932694,-0.00032847494,0.053196657,0.004512845,0.07130436,0.015812559,-0.018741332,-0.013073874,-0.007892199,-0.019248234,-0.009955012,0.032836054,-0.014855075,0.023303458,0.015207091,0.009074972,-0.0056885784,0.011862939,0.024035653,0.015925204,-0.009743803,0.0034603172,-0.04072121,-0.019670654,0.0030660594,0.05947662,0.04956385,0.054238625,-0.013552615,-0.017910574,0.021824991,-0.018755412,-0.0070156786,0.072374485,-0.017220622,-0.0026982026,-0.022557184,-0.0052450383,-0.029541183,0.020670379,-0.013320285,0.0171643,-0.009962053,-0.014172164,0.060997333,0.026091425,-0.0055583324,0.02333162,-0.0022722632,-0.03430044,0.03407515,-0.06009617,-0.013454052,-0.02533107,0.012369842,-0.025795732,0.014939559,0.002090975,0.008011884,0.02333162,0.010729448,-0.01209527,-0.00059798715,-0.021881314,0.01496772,-0.022641668,0.0033758334,-0.029315893,-0.040411435,0.00549497,0.00019602891,-0.011250432,-0.018783573,-0.007343054,0.033483762,-0.06094101,0.0791332,-0.017572638,-0.020740783,-0.005459768,-0.019234154,0.00011418519,0.001849844,0.012496568,0.005875147,0.0068995133,-0.03767979,0.016657397,0.014700188,-0.012482488,-0.018332994,-0.019431284,-0.019881863,-0.0050056675,0.005259119,0.0046571717,0.0114264395,-0.015080365,-0.040355112,-0.019135589,-0.020290202,0.003763051,-0.03804589,0.021247685,0.006339808,-0.043621823,-0.01540422,0.051084563,-0.039538436,0.0020328923,0.023852604,0.02861186,0.0045867683,-0.0056287358,-0.037003923,0.019177832,0.015784398,-0.037538987,-0.022838797,0.07986539,-0.0037665712,-0.037482664,-0.005456248,-0.0132498825,0.040383276,-0.004093946,-0.0021191363,-0.0034391964,0.0022564225,0.03320215,0.004709974,0.008955287,0.019670654,0.0035025591,0.012623293,-0.018023219,0.0032455875,-0.0018991263,-0.002178979,-0.00073659344,0.014235527,0.0069206343,-0.019234154,-0.04466379,-0.03548321,-0.011278592,0.008420222,0.016136413,0.049141433,-0.014714269,-0.019459445,-0.014756511,0.0048296596,0.009546674,-0.012616253,0.020656299,0.019037025,-0.0077795535,0.022078443,0.010194384,-0.015742155,-0.02816128,0.02862594,-0.024303185,-0.0003260548,0.027710699,-0.0088848835,-0.053985175,-0.045593113,0.01209527,0.0052767196,-0.020937912,-0.0075190617,0.029963601,0.0004800618,0.015052204,-0.0088426415,0.00615676,-0.0067446264,0.04066489,-0.046832208,0.04488908,0.03565218,0.019938186,-0.012574011,0.022514943,-0.023669556,-0.00814565,0.00032737487,-0.06206746,-0.0017046374,-0.022331895,-0.02044509,0.05260527,0.0074768197,0.012348721,-0.029118763,0.008729997,-0.022064362,0.002004731,0.008687755,-0.0676434,-0.015291574,0.0014168643,0.002770366,0.024993137,0.0031188617,-0.015390139,0.006037074,-0.0061954814,0.035370566,-0.080147,0.056632333,-0.010046536,0.03430044,-0.00024333106,0.010321109,0.024359507,-0.040608566,0.0026770816,0.051985722,-0.0011299714,0.0055160904,-0.050774787,-0.023007765,-0.009039771,-0.04049592,0.007631707,0.013461092,0.057082914,0.026274474,0.021768669,0.0052415184,0.004878942,-0.0050901514,-0.014010237,0.022106605,0.02265575,-0.003784172,-0.006892473,-0.08932758,-0.005678018,0.0079907635,-0.00880744,-0.05522427,-0.029963601,0.00035333604,0.0068819127,0.009976134,0.0017662402,-0.029400377,-0.02861186,-0.008096368,-0.029315893,-0.004361478,-0.03185041,0.015770316,-0.022106605,0.021585621,0.02002267,-0.035567697,-0.028766748,0.054013334,0.004136188,0.007223368,0.0090538515,-0.01737551,-0.036412533,-0.0021296968,-0.020163476,0.0088003995,-0.042974114,0.006543977,0.037933245,0.0025732368,-0.02686586,0.014869155,-0.013327326,0.00089940085,-0.034018826,0.039144177,-0.008223094,-0.022205168,-0.007181126,-0.005526651,0.010757609,-0.026443442,-0.008701836,0.029118763,0.0020575335,-0.0041009863,0.014341132,0.013172438,0.009504432,0.0040763454,0.041340757,-0.01319356,-0.0059561105,-0.011187068,0.00880744,-0.00058214646,-0.023444265,0.03635621,0.0005874267,0.015953366,-6.121778e-05,-0.031202698,0.025598602,0.0111729875,0.012961229,-0.014010237,0.009490351,0.003833454,0.011546125,-0.009884609,0.057111073,-0.041059148,0.017896494,-0.0076176263,-0.008180852,-0.007086082,-0.0023021847,-0.007659868,-0.012214955,-0.031963054,0.006558058,-0.011278592,0.02202212,-0.025894297,-0.019051105,-0.0018586444,-0.031427987,-0.010461915,0.0018815255,-0.0058786673,0.02309225,0.00029371335,0.022275573,-0.09434029,0.023641394,0.016150493,-0.020966073,-0.0019554489,-0.004231232,0.006427812,0.008434303,0.014503059,-0.021289928,0.016995333,-0.05499898,-0.008223094,-0.015784398,0.031568795,-0.031765923,-0.011722133,0.0078217955,0.011201149,-0.017347349,0.017685283,0.012292398,0.029625665,0.013271003,-0.018164026,0.006867832,-0.014411535,0.016741881,0.043030437,-0.032864213,0.012376882,0.040833857,-0.022345975,-0.018600525,-0.007835876,0.07198023,0.00014927678,0.014855075,0.023472426,0.000815357,0.010947698,0.0035060793,-0.0023197853,-0.0012074149,0.056378882,-0.020078992,0.009581875,0.016389865,-0.04517069,0.020614056,0.0013623019,0.0020328923,-0.010271827,-0.002045213,0.0031839847,-0.032075696,-0.054914497,-0.02006491,-0.015263414,-0.014144002,0.013045712,0.013665261,0.023261217,-0.047846016,-0.0071846466,0.016389865,-0.010292947,0.007666908,-0.03632805,0.0032596681,0.019487606,-0.0079062795,-0.017896494,-0.007244489,-0.02971015,0.035595857,-0.004819099,-0.028076796,-0.004815579,0.012721858,0.034666535,-0.022388218,0.008870803,0.05677314,0.008293496,0.016122332,0.015798477,-0.021444814,0.0022863438,0.0055759335,0.03500447,-0.018755412,-0.007343054,0.007547223,0.036863115,-0.011891101,0.022740234,0.022543104,-0.0067903884,0.00946219,0.017206542,-0.03061131,0.005582974,0.040326953,-0.015122607,0.030245215,0.009046811,-0.029766472,-0.039453954,-0.0054386472,0.018107703,0.012637374,-0.033173986,0.014559382,-0.043706305,0.011982624,0.0017046374,0.041735016,-0.009046811,0.0014731869,-0.009926851,0.0061743604,-0.04621266,0.018839896,-0.006667183,0.03934131,-0.0037313695,0.006114518,0.0015673512,0.0015444702,0.021487057,0.01408768,-0.03610276,0.015136688,-0.025866136,-0.009370666,0.0032086258,-0.0129541885,0.0075824247,-0.013263963,0.0056885784,0.046325304,0.005871627,-0.03255444,0.00024487113,0.018304832,-0.0050584697,-0.035905633,-0.029287731,0.00638205,0.014953639,-0.01872725,-0.00047874174,-0.0032455875,-0.026936265,0.04179134,-0.013355487,-0.054266784,-0.00062350836,0.014165124,-0.02817536,0.029681988,0.0154183,-0.0022793035,0.02686586,-0.022810636,0.003345912,-0.01627722,0.012735939,-0.013383648,-0.0037348897,0.006026514,0.032836054,0.03810221,0.00835686,0.034807343,0.029175086,0.00989165,-0.031991214,0.010961778,-0.002177219,0.019177832,-0.01565767,-0.004291075,0.039707404,0.03168144,0.008744078,0.0079062795,0.01805138,0.008349819,0.018938461,0.029625665,0.01872725,0.03942579,-0.06978365,0.030780278,-0.024373587,0.02003675,-0.015939284,-0.0017785608,-0.0042805145,0.013517414,0.01013102,0.00594203,0.032019377,0.021064637,-0.0022793035,-0.014911397,0.017347349,0.011827737,-0.025922459,0.0034673575,-0.012623293,0.009145375,-0.03525792,-0.01916375,-0.015305655,-0.054041497,0.008786319,-0.031568795,-0.006294046,-0.00020790944,-0.028977957,0.0034708777,0.009814206,-0.0046818126,0.0022775435,0.017600799,-0.0006446293,0.022951443,-0.027555812,0.04286147,-0.008054126,0.004449482,0.0052203974,-0.0095185125,0.01936088,0.007385296,0.018839896,-0.016741881,0.011806617,0.02906244,0.00220362,-0.014474898,-0.036299888,-0.0064946953,0.017262865,0.024964975,-0.009842367,0.02551412,-0.002483473,0.02531699,0.012679616,-0.009504432,0.0061285985,0.018811734,-0.02861186,0.009617077,0.0028372488,-0.035821147,-0.0065474976,-0.028147198,0.009448109,-0.0052415184,-0.04925408,-0.007160005,-0.02002267,-0.0026682813,0.02112096,-0.0021965797,-0.030442344,-0.019459445,-0.011757335,-0.0063468483,-0.0042558736,0.0259647,-0.0023285858,-0.018107703,-0.027189715,-0.02840065,0.00079159596,0.041002825,-0.002992136,0.005301361,0.011940382,0.0036680067,-0.011539084,-0.020599976,0.013109076,0.0018428038,-0.010370391,-0.0078217955,-0.0030026964,-0.010152142,0.012193834,-0.013137237,-0.02442991,-0.002819648,0.028006393,0.0032966298,0.003981301,-0.021951718,0.021036476,0.011377157,0.023852604,0.0009539634,0.030188892,-0.011961504,-0.028921634,-0.003984821,-0.015361978,-0.0060229935,0.021458896,0.0068502314,0.0130809145,0.003212146,-0.014418575,-0.018121783,-0.020599976,0.014545301,0.0063046063,0.026175909,0.00015675712,0.013925753,-0.022120684,0.008159731,0.024514394,-0.022374136,-0.009581875,0.0070156786,-0.024514394,-0.016685558,-0.0076246667,-0.0047381353,-0.056040946,0.01430593,-0.021824991,-0.020515492,0.011539084,-0.0071212836,0.021839073,0.006804469,-0.030639471,-0.029287731,0.02442991,0.014545301,0.014432656,-0.019135589,-0.01341885,0.024824169,0.08454016,0.018656848,-0.0061532394,0.028273925,0.018670928,0.0079062795,0.021937637,-0.018304832,-0.0040446636,-0.026668731,-0.0039742608,0.027781103,0.0068959934,0.004276994,0.0078217955,-0.017558558,-0.014207366,0.031540632,0.035680342,-0.007638747,0.019191911,-0.012243116,0.021824991,0.012010786,0.016896768,-0.015277494,0.021824991,-0.012137512,0.00461845,0.0046923733,-0.020121234,-0.030695794,0.02000859,0.0043649985,-0.0158548,0.013172438,-0.004857821,0.034187794,0.028259844,0.004027063,0.010764649,1.0642983e-05,0.0035007992,-0.008962328,0.008124529,0.04401608,0.009807166,-0.012961229,0.027992312,-0.042974114,-0.008462464,0.014953639,0.010525278,-0.030780278,0.0023426665,0.014144002,-0.012644415,0.018530123,-0.008638472,0.016741881,-0.014277768,0.010940657,-0.010863214,0.019670654,-0.025274748,-0.0040657846,-0.03145615,-0.0048014983,-0.010483037,-0.02710523,-0.049028788,-0.00010994999,0.007913319,-0.014812833,0.008497667,-0.038637277,-0.0046536513,-0.028302087,-0.00072251284,-0.014587543,0.031371664,0.024359507,0.00638205,0.01343293,-0.039003372,-0.0079274,0.011334915,-0.013179479,-0.04995811,0.016967172,0.0013807827,0.037567146,0.0007744352,0.031287182,-0.014700188,-0.001649195,-0.008223094,0.031118214,-0.00462197,0.007385296,0.013397729,-0.012574011,0.020797106,0.014798752,-0.0028425292,0.017079815,0.035314243,-0.022740234,0.013707503,-0.007343054,0.04069305,0.023387942,-0.029175086,0.008427263,-0.03297686,0.045227014,-0.012961229,0.015911123,0.0020170517,-0.029822795,0.0049810265,0.0015145488,0.021613782,0.025387393,0.026161829,0.019107427,0.0007568344,-0.016671477,-0.029175086,-0.011433479,0.0031382225,0.014474898,0.005678018,-0.014911397,-0.013320285,0.006054675,0.0055336915,0.012707777,-0.005463288,0.016601074,-0.033962503,0.000681591,0.006533417,0.024246862,-0.032244664,-0.003367033,0.023148572,0.0045515667,-0.009976134,-0.01341885,-0.021177283,-0.019895945,0.030695794,-0.004273474,-0.005854026,-0.03277973,0.010771689,-0.015291574,-0.0033881539,0.017671203,-0.013637099,-0.032300986,-0.005970191,-0.0106660845,-0.034638375,-0.0076528275,0.0051887156,0.0014027838,-0.015728075,0.024387669,-0.021092799,0.004467083,-0.004273474,0.00041229874,0.011912221,-0.0017741607,-0.006110998,-0.013496294,-0.045001727,0.009701561,-0.032300986,-0.01691085,-0.0016377544,-0.006015953,0.03846831,-0.002467632,-0.032272827,-0.0131653985,0.025218425,0.003632805,0.0018375235,-0.027429087,0.005970191,0.0054245666,0.03846831,0.035961956,0.014348172,0.012010786,0.0048331795,-0.00041933905,-0.03497631,-0.006445413,-0.054097816,-0.0050725504,-0.012475447,0.007504981,0.01872725,-0.014045438,0.0021912996,0.028977957,0.00021021956,0.01472835,0.017136138,0.031991214,-0.014277768,0.023923008,-0.0057977033,0.032667086,0.0056885784,0.002224741,0.014883236,-0.023176733,0.0075401827,-0.04336837,0.029569343,-0.024542555,0.016671477,-0.006075796,0.020515492,-0.016558832,-0.0017908814,-0.019614331,-0.025443716,0.040862016,0.004706454,-0.018952541,-0.024007492,-0.013228761,-0.007399376,0.02973831,0.004949345,-0.024472153,0.0018428038,0.008504706,-0.015953366,0.0063996506,0.034835503,0.0004769817,0.0041960306,0.00086375925,0.03241363,0.009743803,0.024077894,-0.016403945,-0.025007216,-0.025485959,0.013672302,0.0062553245,-0.014460817,-0.0071424046,-0.04136892,0.006772788,-0.025007216,-0.00024949134,0.03277973,0.021430735,-0.018332994,-0.0025908377,-0.039482113,-0.00594203,0.014953639,0.040242467,-0.01298235,-0.009166497,-0.0067023844,0.0107083265,0.023472426,-0.013813107,-0.005234478,-0.027569892,-0.023627313,0.0022212209,-0.0246552,0.0013138998,0.013777906,0.002819648,-0.007307852,0.017727526,0.023627313,0.038665436,0.017558558,0.018431557,-0.021219524,-0.018530123,-0.0011845338,0.007941481,-0.0052274377,0.01451714,0.007645787,0.011327875,-0.018670928,-0.03187857,0.015249333,-0.028654102,0.016544752,-0.0010226065,0.010743529,0.015432381,-0.0054386472,0.008525827,0.01605193,-0.013263963,-0.025204346,-0.036074597,0.016798204,0.016249059,-0.014925478,-0.012186794,-0.008568069,0.0028671704,0.010912496,0.0074697793,0.017220622,-0.007835876,0.008631432,0.037285533,-0.021853153,-0.018375235,0.0038088132,-0.0453115,0.030723955,0.028288005,0.011848859,-0.015460542,-0.008779279,-0.018079542,-0.0012153352,0.020740783,-0.0075331423,-0.0029516541,-0.0023479466,-0.014995881,-0.025232507,-0.012130471,0.01651659,0.015361978,0.033934344,0.015333816,0.012855624,0.049141433,0.011567245,0.004748696,-0.024106055,0.019558009,0.010982899,0.0019184871,0.025823893,0.0010903695,0.020825267,-0.008624392,0.0004026183,-0.0049634255,-0.016023768,0.02595062,-0.026288554,0.027583973,0.014657946,-0.056913946,0.0001938288,0.006015953,0.029850956,-0.003543041,0.013320285,-0.013045712,-0.0112152295,-0.007307852,-0.009771964,0.038186695,0.0055372114,-0.021881314,0.00881448,0.007114243,0.022571266,-0.0096874805,0.055393238,-0.012559931,-0.012376882,0.0067868684,-0.0019976909]
\.


--
-- Data for Name: knowledge_base_queries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.knowledge_base_queries (id, user_id, query_text, language_code, include_cross_language, results_count, top_results, search_duration_ms, created_at) FROM stdin;
59fb29cc-6436-4322-b6df-4e34f97f81ee	\N	What are the implementation steps?	en	f	5	[{"score": 0.46453089906367384, "title": "Implementation Module Guide", "sourceId": "da7eb6ef-3a45-4a16-9296-f395c3e17e83", "languageCode": "en"}, {"score": 0.33928150790179545, "title": "M-CRM Overview", "sourceId": "e4569aca-e5a4-4cd8-bb41-835710b0c4ed", "languageCode": "en"}, {"score": 0.3133564217857834, "title": "Sales Management Guide", "sourceId": "a19423a7-4076-460b-9ac0-9effada567d1", "languageCode": "en"}, {"score": 0.275385596614647, "title": "Admin Guide - User Management", "sourceId": "6fd0fc89-7e41-4c5b-8a2a-e471afa1d7fc", "languageCode": "en"}, {"score": 0.24580709661203093, "title": "Support Ticket System Guide", "sourceId": "7799d270-236f-4a22-bc41-2865749728f8", "languageCode": "en"}]	370	2025-11-28 13:05:09.78415
c923932b-0e81-4e61-9a88-8e8ee6b7db90	\N	What are the implementation steps?	en	t	5	[{"score": 0.46453089906367384, "title": "Implementation Module Guide", "sourceId": "da7eb6ef-3a45-4a16-9296-f395c3e17e83", "languageCode": "en"}, {"score": 0.33928150790179545, "title": "M-CRM Overview", "sourceId": "e4569aca-e5a4-4cd8-bb41-835710b0c4ed", "languageCode": "en"}, {"score": 0.3133564217857834, "title": "Sales Management Guide", "sourceId": "a19423a7-4076-460b-9ac0-9effada567d1", "languageCode": "en"}, {"score": 0.275385596614647, "title": "Admin Guide - User Management", "sourceId": "6fd0fc89-7e41-4c5b-8a2a-e471afa1d7fc", "languageCode": "en"}, {"score": 0.24580709661203093, "title": "Support Ticket System Guide", "sourceId": "7799d270-236f-4a22-bc41-2865749728f8", "languageCode": "en"}]	291	2025-11-28 13:06:57.817952
\.


--
-- Data for Name: knowledge_base_sources; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.knowledge_base_sources (id, title, description, category, content_type, original_content, language_code, translation_group_id, translation_status, source_url, file_url, file_name, file_size, is_indexed, indexed_at, token_count, chunk_count, created_by, is_active, created_at, updated_at) FROM stdin;
7799d270-236f-4a22-bc41-2865749728f8	Support Ticket System Guide	Complete guide for managing customer support tickets and escalations	support	guide	# Support Ticket System Guide\n\n## Creating a Support Ticket\n\n### Step-by-Step Process\n1. Navigate to **Support → Tickets** from the sidebar\n2. Click **"New Ticket"** button\n3. Fill in the required fields:\n   - **Customer**: Select from existing customers\n   - **Subject**: Brief description of the issue\n   - **Description**: Detailed explanation of the problem\n   - **Priority**: Low, Medium, High, or Critical\n   - **Category**: Technical, Billing, General, Feature Request\n4. Click **Create Ticket**\n\n### Automatic Ticket Numbering\nTickets are automatically numbered as TKT-XXXXXX for easy reference.\n\n## Ticket Priority Levels\n\n### Low Priority\nMinor issues or questions. No immediate business impact. Response within 48 hours.\n\n### Medium Priority\nModerate issues affecting workflow. Workaround available. Response within 24 hours.\n\n### High Priority\nSignificant issues affecting operations. No workaround available. Response within 4 hours.\n\n### Critical Priority\nSystem down or major functionality broken. Business operations halted. Immediate response required.\n\n## Escalation Process\n\n### Three-Level Escalation\n\n**Level 1 (L1) - Initial Support**\nFirst point of contact. Basic troubleshooting. Common issue resolution.\n\n**Level 2 (L2) - Technical Specialist**\nComplex technical issues. Deeper investigation. Access to development resources.\n\n**Level 3 (L3) - Senior Engineer/Management**\nCritical system issues. Requires management decision. Potential code changes needed.\n\n### How to Escalate\n1. Open the ticket\n2. Click **"Escalate"** button\n3. Select the next level\n4. Add escalation reason\n5. Assign to specific person or let system assign\n\n## Ticket Status Flow\n1. **New** - Just created, awaiting assignment\n2. **Open** - Assigned and being worked on\n3. **Pending** - Waiting for customer response\n4. **Resolved** - Solution implemented\n5. **Closed** - Confirmed resolved	en	\N	original	\N	\N	\N	\N	t	2025-11-28 13:01:32.606392	472	1	\N	t	2025-11-28 12:53:10.862542	2025-11-28 12:53:10.862542
a19423a7-4076-460b-9ac0-9effada567d1	Sales Management Guide	Complete guide for managing leads, quotes, and sales pipeline	sales	guide	# Sales Management Guide\n\n## Creating a Lead\n\n### Step-by-Step Process\n1. Navigate to **Sales → Leads** from the sidebar\n2. Click the **"Add Lead"** button in the top right\n3. Fill in the required fields:\n   - **Customer Name**: Company or individual name\n   - **Contact Person**: Primary contact for communication\n   - **Email**: Valid email address\n   - **Phone**: Contact phone number\n   - **Lead Source**: How the lead was acquired (Website, Referral, Social Media, Cold Call, Exhibition, Advertisement, Partner, Other)\n   - **Assigned Sales Executive**: Team member responsible for this lead\n4. Add optional notes or requirements\n5. Click **Save** to create the lead\n\n## Lead Stages\n\nLeads progress through 5 stages in the sales pipeline:\n\n### 1. New Lead\nFresh inquiry just received. No contact made yet.\n\n### 2. Contacted  \nInitial contact has been made. Customer is aware of our interest.\n\n### 3. Qualified\nRequirements are understood. Customer shows genuine interest. Budget and timeline discussed.\n\n### 4. Proposal\nQuote/proposal has been sent. Awaiting customer decision.\n\n### 5. Closed\nFinal stage - either Won or Lost.\n\n## Managing Quotes\n\n### Creating a Quote\n1. Open the lead details page\n2. Click **"Create Quote"** button\n3. Add line items with product/service, description, quantity, and unit price\n4. Apply discounts if applicable\n5. Add terms and conditions\n6. Click **Save Quote**\n\n## Follow-up Management\n\n### Scheduling Follow-ups\n1. Open any lead\n2. Click **"Add Follow-up"**\n3. Set the follow-up date and time\n4. Add notes about what to discuss\n5. Save the follow-up\n\n## Best Practices\n- Update lead status promptly as it changes\n- Add detailed notes after every interaction\n- Schedule follow-ups immediately after calls\n- Keep quotes valid for 30 days maximum\n- Document reasons for lost deals	en	\N	original	\N	\N	\N	\N	t	2025-11-28 13:01:33.759546	455	1	\N	t	2025-11-28 12:52:47.676588	2025-11-28 12:52:47.676588
6fd0fc89-7e41-4c5b-8a2a-e471afa1d7fc	Admin Guide - User Management	Guide for administrators to manage users, roles, and permissions	general	guide	# Admin Guide - User Management\n\n## Overview\nThe User Management module allows administrators to create users, define roles, and configure permissions for the M-CRM system.\n\n## User Management\n\n### Creating a New User\n1. Navigate to **Admin → User Master**\n2. Click **"Add User"** button\n3. Fill in user details:\n   - Name and email\n   - Role assignment\n   - Department (optional)\n4. User will receive login credentials via email\n\n### User Approval Workflow\nNew user registrations require admin approval:\n1. Go to **Admin → User Approval**\n2. Review pending registrations\n3. Click **Approve** or **Reject**\n4. Approved users can immediately access the system\n\n## Role Management\n\n### Creating Roles\n1. Navigate to **Admin → User Role Master**\n2. Click **"Add Role"**\n3. Enter role name and description\n4. Save the role\n\n### Configuring Permissions\n1. Go to **Admin → User Rights Allocation**\n2. Select a role from dropdown\n3. For each module, set permissions:\n   - **View**: Can see the module\n   - **Create**: Can add new records\n   - **Edit**: Can modify existing records\n   - **Delete**: Can remove records\n4. Click **Save Changes**\n\n## Best Practices\n- Follow principle of least privilege\n- Review user access periodically\n- Disable inactive users instead of deleting\n- Document role changes for audit purposes	en	\N	original	\N	\N	\N	\N	t	2025-11-28 13:01:31.005067	329	1	\N	t	2025-11-28 12:53:26.78977	2025-11-28 12:53:26.78977
e4569aca-e5a4-4cd8-bb41-835710b0c4ed	M-CRM Overview	Overview of M-CRM features and capabilities	general	guide	# M-CRM Overview\n\nM-CRM is a comprehensive Customer Relationship Management platform designed to streamline sales pipeline management, implementation projects, and customer support.\n\n## Key Features\n\n### 1. Sales Management\n- Lead tracking from 11+ social media platforms\n- Sales pipeline with Kanban board visualization\n- Quote generation and management\n- Follow-up scheduling and reminders\n- Negotiation tracking\n\n### 2. Implementation Management\n- 6-step implementation workflow\n- Module-based installation scheduling\n- Training session management\n- Daily progress tracking with photo/video proof\n- Work tracking dashboard\n\n### 3. Support Management\n- Multi-level ticket system (L1, L2, L3)\n- Priority-based ticket handling\n- Escalation workflows\n- Customer feedback collection\n- SLA tracking\n\n### 4. Task Management\n- Voice and video recording attachments\n- Photo capture capabilities\n- File attachments\n- Reminder scheduling\n- Team collaboration features\n\n## User Roles\n- **Sales Executive**: Manages leads and sales pipeline\n- **Engineer**: Handles implementation projects\n- **Support**: Manages support tickets\n- **Admin**: Full system access and configuration\n\n## Getting Started\n1. Log in with your credentials\n2. Navigate to the Dashboard for an overview\n3. Use the sidebar to access different modules\n4. Check My Tasks for pending work items	en	\N	original	\N	\N	\N	\N	t	2025-11-28 13:01:32.009889	338	1	\N	t	2025-11-28 12:53:18.958966	2025-11-28 12:53:18.958966
da7eb6ef-3a45-4a16-9296-f395c3e17e83	Implementation Module Guide	Guide for managing implementation projects and tracking progress	implementation	guide	# Implementation Module Guide\n\n## Creating a New Project\n\n### Step-by-Step Process\n1. Navigate to **Implementation → Projects** from the sidebar\n2. Click **"New Project"** button\n3. Select the customer from the dropdown\n4. Assign one or more engineers to the project\n5. Set the target completion date\n6. Click **Create Project**\n\n### Automatic Module Creation\nWhen a project is created, the system automatically creates 8 module checklists:\n\n1. **Front Office** - Reception, appointment booking, visitor management\n2. **Power Automation** - Workflow automation and business rules\n3. **POS (Point of Sale)** - Sales transactions and billing\n4. **Inventory** - Stock management and tracking\n5. **HR & Payroll** - Employee management and salary processing\n6. **Accounting** - Financial management and reporting\n7. **CRM Integration** - Customer data synchronization\n8. **Reporting** - Custom reports and dashboards\n\n## Tracking Project Progress\n\n### Module Status Updates\nEach module can be in one of these states:\n- **Planning** - Requirements gathering phase\n- **In Progress** - Active implementation\n- **Completed** - Fully implemented and tested\n\n### Adding Progress Entries\n1. Open the project details\n2. Click on a specific module\n3. Click **"Add Progress Entry"**\n4. Fill in work description and hours spent\n5. Attach photos/videos as proof\n6. Save the entry\n\n## Training Records\n\n### Logging Training Sessions\n1. Open the project\n2. Go to **Training** tab\n3. Click **"Add Training Record"**\n4. Fill in module, attendees, duration, topics covered\n5. Save the record\n\n## Project Handover\n\n### Completing a Project\n1. Ensure all modules are marked as Completed\n2. All training sessions are documented\n3. Create handover documentation\n4. Move project to **Support** phase	en	\N	original	\N	\N	\N	\N	t	2025-11-28 13:01:33.438036	443	1	\N	t	2025-11-28 12:53:00.228186	2025-11-28 12:53:00.228186
cc4a84d4-0e55-44f5-8fb6-30a092dec69d	M-CRM UI Standards and Conventions	Guide to M-CRM user interface standards including header sizing, component patterns, and design consistency	general	guide	# M-CRM UI Standards and Conventions\n\n## Overview\nThis guide documents the UI standards used across the M-CRM application to ensure visual consistency and professional appearance.\n\n## Page Headers\n\n### Standard Header Size\nAll page headers use consistent sizing:\n- **Desktop**: `text-xl` (1.25rem / 20px)\n- **Mobile**: `text-lg` (1.125rem / 18px)\n- **Weight**: `font-bold`\n- **Pattern**: `className="text-lg sm:text-xl font-bold"`\n\n### Header with Icons\nWhen headers include icons:\n- Icon size: `h-5 w-5` (1.25rem / 20px)\n- Gap: `gap-2` between icon and text\n- Pattern: `className="text-lg sm:text-xl font-bold flex items-center gap-2"`\n\n### Page Description\nBelow each header:\n- Text: `text-sm text-muted-foreground`\n- Margin: `mb-1` on the header\n\n## Sidebar Design\n\n### M-CRM Branding\n- Logo and "M-CRM" text in sidebar header\n- Text size matches page header sizing\n- Consistent navy blue background with light text\n\n### Menu Items\n- Full text displayed without truncation\n- `whitespace-nowrap` prevents text wrapping\n- Tooltips show full text on hover for collapsed items\n- Icons sized consistently at `h-4 w-4`\n\n### Nested Menus\nCollapsible sub-menus for:\n- User Management (4 sub-items)\n- System Settings (2 sub-items)\n- Reports (3 sub-items)\n\n## Component Patterns\n\n### Cards\n- Used for content grouping\n- Consistent padding and spacing\n- Headers with titles and descriptions\n\n### Buttons\n- Primary: Default blue for main actions\n- Outline: For secondary actions\n- Ghost: For subtle actions\n- Consistent height using built-in sizes\n\n### Forms\n- Labels above inputs\n- Consistent input heights\n- Validation messages below fields\n- Submit buttons aligned right\n\n### Tables\n- Zebra striping for readability\n- Action buttons in rightmost column\n- Consistent column widths\n\n## Responsive Design\n\n### Breakpoints\n- **Mobile** (<640px): Single column, stacked layouts\n- **Tablet** (640px-1024px): Two columns where appropriate\n- **Desktop** (>1024px): Full multi-column layouts\n\n### Mobile Considerations\n- Touch-friendly button sizes (min 44px)\n- Collapsible sidebar\n- Stacked form layouts\n- Horizontal scroll for tables\n\n## Dark Mode\n\n### Implementation\n- CSS variables for colors\n- Automatic switching via `dark:` classes\n- Consistent contrast ratios\n- Chart colors adapt to theme\n\n### Color Variables\n- `--background` and `--foreground` for base\n- `--primary` for brand color\n- `--muted` for secondary text\n- `--border` for separators\n\n## Accessibility\n\n### Standards\n- Semantic HTML elements\n- ARIA labels on interactive elements\n- Focus indicators visible\n- Color contrast meets WCAG AA\n\n### Test IDs\n- `data-testid` on all interactive elements\n- Pattern: `{action}-{target}` (e.g., "button-save")\n- For lists: `{type}-{id}` (e.g., "row-user-123")\n\n## Best Practices\n\n### Consistency\n- Use shared components over custom styling\n- Follow established patterns for new features\n- Match sizing and spacing to existing pages\n\n### Performance\n- Lazy load heavy components\n- Optimize images\n- Minimize re-renders with proper state management\n\n### Maintenance\n- Document new patterns in this guide\n- Review UI changes for consistency\n- Test across all breakpoints	en	\N	original	\N	\N	\N	\N	t	2025-12-01 18:52:51.385715	790	1	\N	f	2025-12-01 18:48:23.64765	2025-12-01 18:52:48.435
e8cefc7b-5fbf-4ca9-bb62-c762005e9d6d	Department Management Guide	Complete guide to department management including organizational hierarchy, manager assignment, and department-based workflows	general	guide	# Department Management Guide\n\n## Overview\nThe Department Master module allows administrators to organize users into logical departments, creating an organizational hierarchy for approval workflows, escalation paths, and reporting.\n\n## Accessing Department Management\n1. Navigate to **Master Data** in the sidebar\n2. Select the **Departments** tab\n3. View, create, edit or delete departments\n\n## Creating a Department\n\n### Required Fields\n- **Name**: The department name (e.g., "Sales", "Engineering", "Support")\n- **Description**: Optional description of the department's purpose\n\n### Optional Fields\n- **Manager**: Select a user as the department head\n  - Manager receives escalated items\n  - Manager can view all department activity\n  - Manager appears in approval workflows\n\n### Steps to Create\n1. Click **"Add Department"** button\n2. Enter department name\n3. Add optional description\n4. Select a manager from the user dropdown (optional)\n5. Click **Save**\n\n## Editing Departments\n1. Find the department in the list\n2. Click the **Edit** icon\n3. Modify fields as needed\n4. Click **Save**\n\nNote: Changing a department name or manager affects all users and records linked to that department.\n\n## Deleting Departments\n1. Click the **Delete** icon next to the department\n2. Confirm deletion\n\n**Important**: Departments with active users or linked records cannot be deleted. Reassign users first.\n\n## Department-User Relationship\n- Each user can belong to one primary department\n- Department assignment happens in User Master\n- Department filters are available in Reports and Lists\n\n## Use Cases\n\n### Organizational Structure\nCreate departments matching your company structure:\n- Sales → Sub-teams (Inside Sales, Field Sales)\n- Engineering → Implementation, Development\n- Support → L1, L2, L3 Support Teams\n\n### Approval Workflows\n- Department managers receive approval requests\n- Escalation paths follow department hierarchy\n- Reports can filter by department\n\n### Points System Integration\n- Point categories can be linked to departments\n- Department-specific performance tracking\n- Points leaderboards per department\n\n## Best Practices\n- Keep department names clear and consistent\n- Always assign a manager for approval workflows\n- Review department assignments quarterly\n- Use departments for reporting segmentation	en	\N	original	\N	\N	\N	\N	t	2025-12-01 18:53:07.695878	580	1	\N	t	2025-12-01 18:47:19.687554	2025-12-01 18:47:19.687554
8b6acb9c-48c3-4046-88c8-8025302a095e	Points System and Gamification Guide	Complete guide to the M-CRM points/scoring system including point categories, department configuration, user balances, and gamification features	general	guide	# Points System and Gamification Guide\n\n## Overview\nThe M-CRM Points System enables gamification of work activities. Users earn points for completing tasks, closing deals, resolving tickets, and other measurable activities. Points can be tracked by department for team-based competitions.\n\n## Accessing Points Management\n1. Navigate to **System Settings** in the sidebar\n2. Select **Points Management**\n3. View point categories, balances, and leaderboards\n\n## Point Categories\n\n### What Are Point Categories?\nPoint categories define the activities that earn points and their values. Each category is linked to a department and specifies how many points are awarded.\n\n### Creating Point Categories\n1. Click **"Add Category"** button\n2. Fill in the form:\n   - **Department**: Select the relevant department\n   - **Points**: Enter the point value (positive number)\n   - **Description**: Optional explanation\n   - **Active**: Toggle to enable/disable\n3. Click **Save**\n\n### Category Name Auto-Generation\nThe category name is automatically derived from the selected department:\n- Department "Sales" → Category name "Sales Points"\n- Department "Support" → Category name "Support Points"\n\nThis ensures consistency and prevents naming conflicts.\n\n## Point Earning\n\n### How Points Are Earned\nPoints are awarded automatically based on system events:\n- **Sales**: Lead conversion, quote acceptance, deal closure\n- **Implementation**: Module completion, training delivery\n- **Support**: Ticket resolution, customer satisfaction scores\n- **Tasks**: Task completion, on-time delivery\n\n### Assignment Events\nEach point award creates an assignment event record:\n- User who earned the points\n- Category that applies\n- Points awarded\n- Timestamp\n- Source activity (lead ID, ticket ID, etc.)\n\n## User Point Balances\n\n### Viewing Balances\nThe Points Management page shows:\n- **User Balances Tab**: Per-user point totals\n- Points by category\n- Recent point history\n\n### Balance Calculation\nUser balances are calculated from the sum of all assignment events:\n- Real-time totals\n- Historical tracking\n- Department aggregations\n\n## Department Configuration\n\n### Department-Specific Settings\nEach department can have customized point settings:\n- Different point multipliers\n- Category-specific rules\n- Department leaderboards\n\n### Linking Points to Departments\nWhen creating a point category:\n1. Select the Department dropdown\n2. Choose the appropriate department\n3. The backend automatically links the category\n\n## Leaderboards\n\n### Individual Leaderboards\n- Shows top point earners across the organization\n- Filtered by time period (weekly, monthly, all-time)\n- Displays rank, name, and points\n\n### Department Leaderboards\n- Aggregates points by department\n- Shows team performance\n- Enables healthy competition between teams\n\n## Best Practices\n\n### Setting Point Values\n- Balance point values across activities\n- Higher points for high-value activities (deal closure)\n- Lower points for routine tasks\n- Review and adjust quarterly\n\n### Fairness Considerations\n- Ensure points reflect actual value\n- Account for different job roles\n- Monitor for gaming behavior\n- Celebrate achievements publicly\n\n### Integration with Goals\n- Set monthly/quarterly point targets\n- Use points as one metric among many\n- Combine with qualitative feedback\n- Avoid purely point-driven culture\n\n## Technical Architecture\n\n### Database Tables\nThe points system uses five interconnected tables:\n1. **point_categories**: Defines earning activities\n2. **point_category_department_settings**: Department customizations\n3. **assignment_events**: Individual point awards\n4. **user_point_ledger**: Transaction history\n5. **user_point_balances**: Cached totals for performance\n\n### API Endpoints\n- `GET /api/point-categories` - List all categories\n- `POST /api/point-categories` - Create new category\n- `PATCH /api/point-categories/:id` - Update category\n- `DELETE /api/point-categories/:id` - Delete category\n- `GET /api/points/user/:userId/balance` - User balance\n\n## Troubleshooting\n\n### Points Not Appearing\n1. Check if the category is active\n2. Verify user is in correct department\n3. Confirm the triggering activity completed\n\n### Balance Discrepancies\n1. Review assignment events history\n2. Check for duplicate entries\n3. Verify category point values	en	\N	original	\N	\N	\N	\N	t	2025-12-01 18:53:12.712241	1076	2	\N	t	2025-12-01 18:47:51.848239	2025-12-01 18:47:51.848239
\.


--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leads (id, customer_id, company_name, contact_person, contact_email, contact_phone, lead_source, estimated_value, stage, sales_executive_id, demo_date, quote_sent_date, quote_value, selected_modules, negotiation_date, closed_date, confirmed_order_value, closed_reason, days_in_stage, created_at, updated_at) FROM stdin;
ef943b85-804f-46ac-982c-29d6753159b8	\N	Test Corp	John Doe	john@testcorp.com	+1-555-0123	website	\N	new_lead	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2025-11-28 12:43:20.161516	2025-11-28 12:43:20.161516
2c1854d9-d440-4105-a698-aafa32a4a28d	\N	DocTest Corp	John File	john.file@doctest.com	+1-555-1234	website	\N	new_lead	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2025-11-28 12:43:20.161516	2025-11-28 12:43:20.161516
30a9a8ad-fb1f-46f2-a003-590dbf93c68c	\N	Test Company Edit	Updated Contact Name	test.edit@example.com	\N	website	\N	closed_won	\N	\N	\N	\N	\N	\N	\N	540000	\N	0	2025-11-28 12:43:20.161516	2025-11-28 12:43:20.161516
999de455-f290-4738-833b-99dba51bf115	\N	Microgenn Software Solutions	Senthil	smart@hotelsmartlock.com	+919363150105	website	\N	closed_won	\N	\N	\N	60000	{"Front Office",POS}	\N	\N	55000	\N	0	2025-11-28 12:43:20.161516	2025-11-28 12:43:20.161516
f6fa8650-4968-497f-bd48-875b83e827d2	\N	Test Company -JqtKn	John Doe	test@example.com	1234567890	website	\N	closed_won	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2025-11-28 12:43:20.161516	2025-11-28 12:43:20.161516
126d0164-d4a5-42a6-a3b8-131ce49d8066	\N	Test Company eXt4G3	John Doe	test@example.com	1234567890	website	\N	closed_won	test-admin-001	\N	\N	\N	{"Front Office","Inventory Management","POS (Point of Sale)"}	\N	\N	\N	\N	0	2025-11-28 12:43:20.161516	2025-11-28 12:43:20.161516
7a859167-b4a1-4c10-a895-c01739fd11ca	\N	Sri Bhagavathi Residency	Dr.Suresh	suresh@sribhagavathi.com	+919876543210	referral	\N	closed_won	sales_user_abc123	\N	\N	540000	{"Front Office",POS,"Reporting & Analytics",Accounting}	\N	\N	500000	\N	0	2025-11-28 12:43:20.161516	2025-11-28 12:43:20.161516
b6f3393f-080a-406e-9c03-1eb24dcfb23c	\N	Raja Rani	Mr.Rajan		9952511119	linkedin	\N	demo_scheduled	\N	2025-12-02 04:30:00	\N	\N	\N	\N	\N	\N	\N	0	2025-11-28 12:43:20.161516	2025-12-01 13:27:19.966
\.


--
-- Data for Name: modules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.modules (id, name, description, created_at) FROM stdin;
050433df-643a-4c80-9815-045b0a1f0a05	Front Office	Reception and customer-facing operations management	2025-11-28 12:41:44.237682
b74b7454-956d-4017-80f0-7e14d45e92a7	Power Automation	Business process automation and workflow optimization	2025-11-28 12:41:44.237682
e1504acd-12c8-41d2-9661-7035ce94ed7d	POS (Point of Sale)	Retail sales and payment processing system	2025-11-28 12:41:44.237682
f5679b30-03d3-4846-86f5-8779dc487c8a	Inventory Management	Stock tracking and warehouse management	2025-11-28 12:41:44.237682
28db8e58-91fd-4207-85d5-1dcc55a6a97c	HR & Payroll	Human resources and payroll processing	2025-11-28 12:41:44.237682
7f49d048-a309-4960-8d01-be6d95fdf924	Reporting & Analytics	Business intelligence and data analytics	2025-11-28 12:41:44.237682
590bf4e1-7730-49c3-9b3e-18da78d566ae	Custom Integration	Custom third-party integration module	2025-11-28 12:41:44.237682
9996e94c-2c5d-4c36-a499-38c5d1e68c01	Accounting	Financial accounting and bookkeeping	2025-11-28 12:41:44.237682
e268f956-a60f-40d8-aaef-d4219b56cb4b	CRM Integration	Customer relationship management tools	2025-11-28 12:41:44.237682
\.


--
-- Data for Name: negotiation_date_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.negotiation_date_history (id, lead_id, negotiation_date, notes, changed_by_id, created_at) FROM stdin;
\.


--
-- Data for Name: otp_verifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.otp_verifications (id, email, otp_code, purpose, expires_at, is_used, attempts, created_at) FROM stdin;
49d978e7-02e0-4bdd-91a1-75ff6673b98b	digitalmarket@microgenn.in	980694	signup	2025-11-28 12:59:00.112	t	0	2025-11-28 12:49:00.18435
8ef21469-8f94-4b89-90d5-ef7373830c26	sales@microgenn.com	325052	signup	2025-11-29 05:04:19.92	f	0	2025-11-29 04:54:19.999287
94297889-5199-4e1d-8ce3-4b97223c81f0	digitalmarket@microgenn.in	427188	signup	2025-11-29 04:41:40.634	t	0	2025-11-29 04:31:40.71726
cd1d2bcd-024b-45ad-a71a-b5eb9159f80d	newtest@example.com	630571	signup	2025-11-29 05:50:08.138	f	0	2025-11-29 05:40:08.162722
c5238460-fdb6-442f-977c-70779a2f8996	accounts@microgenn.com	929723	signup	2025-11-29 05:52:44.53	t	0	2025-11-29 05:42:44.564209
15991b7f-dfe5-4fc8-a0a1-52ceea1ffb05	accounts@microgenn.com	114061	signup	2025-11-29 05:53:40.651	t	0	2025-11-29 05:43:40.67569
72bc983d-1bff-4da2-89cc-9f1d25579cc8	accounts@microgenn.com	202988	signup	2025-11-29 05:55:37.142	t	0	2025-11-29 05:45:37.178079
dbc5cb68-7089-4f20-a44c-0abce9a67c09	accounts@microgenn.com	199001	signup	2025-11-29 05:56:28.746	t	0	2025-11-29 05:46:28.784875
b9185bd6-c14d-4527-b0a0-e91d756b1dad	arun@microgenn.com	471278	signup	2025-11-29 09:47:00.71	f	0	2025-11-29 09:37:00.790615
3e7cb601-bd78-435c-b2e9-2a787d376db2	snayagamk@gmail.com	916581	signup	2025-11-29 08:50:53.183	t	0	2025-11-29 08:40:53.21891
a2240eb4-9dc1-440d-bb8d-1e4c0577c03a	senthil@microgenn.com	682982	password_reset	2025-11-29 16:54:49.169	f	0	2025-11-29 16:44:49.212134
8fc266c2-07d3-4fec-a6a6-435d1319c643	snayagamk@gmail.com	944233	signup	2025-11-29 16:32:22.257	t	0	2025-11-29 16:22:22.290997
5fe3baab-3732-44df-b228-7500dd0a6533	digitalmarket@microgenn.in	572527	signup	2025-11-29 05:12:58.638	t	0	2025-11-29 05:02:58.711687
9ab5519c-5e45-4d26-8237-ef6cf14f5313	digitalmarket@microgenn.in	159306	signup	2025-12-01 04:42:07.723	f	0	2025-12-01 04:32:07.799659
ebfd4941-e8dc-4b44-9b3c-989db8c0e0e9	snayagamk@gmail.com	415038	signup	2025-11-29 16:55:10.702	t	0	2025-11-29 16:45:10.73002
d36cd276-845f-4ce0-a7db-f1d77f4a11cc	snayagamk@gmail.com	944972	signup	2025-12-01 14:08:01.375	t	1	2025-12-01 13:58:01.410957
02a13b1c-c8a0-4426-923a-5bc4a4a26d64	accounts@microgenn.com	808650	signup	2025-11-29 06:42:45.16	t	0	2025-11-29 06:32:45.19011
f98b697d-2e93-4661-b051-7cd1a6761b8c	accounts@microgenn.com	778834	signup	2025-12-01 14:13:06.164	f	0	2025-12-01 14:03:06.200095
b4b2d8ce-90ce-42a8-9286-70cd46a350de	test@example.com	749014	signup	2025-11-29 05:49:35.168	t	0	2025-11-29 05:39:35.194254
7fb74828-8ec2-4f0f-b3ff-46cb0b6606d4	test@example.com	246752	signup	2025-12-01 14:16:25.834	f	0	2025-12-01 14:06:25.870248
c17d93e5-744f-4ad5-aa7a-abb8422a2fa2	test-1764610924626@example.com	358235	signup	2025-12-01 17:52:15.654	f	0	2025-12-01 17:42:15.699178
\.


--
-- Data for Name: planning_change_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.planning_change_logs (id, project_module_id, project_id, changed_by, change_type, field_name, old_value, new_value, old_engineer_id, new_engineer_id, reason, created_at) FROM stdin;
\.


--
-- Data for Name: point_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.point_categories (id, name, description, module_type, base_points, reassign_penalty, completion_bonus, is_active, created_at, updated_at, department_id) FROM stdin;
\.


--
-- Data for Name: point_category_department_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.point_category_department_settings (id, point_category_id, department, base_points, reassign_penalty, completion_bonus, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: project_engineers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_engineers (id, project_id, engineer_id, assigned_at) FROM stdin;
\.


--
-- Data for Name: project_handoffs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_handoffs (id, project_id, completion_certificate_issued, completion_certificate_date, training_certificate_issued, training_certificate_date, handoff_date, handoff_to_team, handoff_by_id, notes, status, created_at, updated_at) FROM stdin;
90f5cda7-431e-4bce-8932-59c5794fbd16	2483de02-b507-4b7a-bd14-46928008daf9	t	2025-11-27 00:00:00	f	\N	2025-11-27 00:00:00	support	46525611	completed with good will	handed_off	2025-11-28 12:44:41.937941	2025-11-28 12:44:41.937941
6afe4b02-ab8b-4479-9120-2c35cd0bd651	35bbfdf1-3c16-4ab2-b59a-92e7d7c57719	t	2025-11-27 00:00:00	f	\N	2025-11-27 00:00:00	support	46525611	completed	handed_off	2025-11-28 12:44:41.937941	2025-11-28 12:44:41.937941
\.


--
-- Data for Name: project_modules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_modules (id, project_id, module_id, assigned_engineer_id, scheduled_start_date, scheduled_end_date, department_name, department_contact, installation_status, installation_notes, actual_engineer_id, actual_visit_date, completed, completed_at) FROM stdin;
\.


--
-- Data for Name: project_progress_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_progress_entries (id, project_id, engineer_id, progress_date, progress_type, description, attachments, created_at) FROM stdin;
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (id, customer_id, lead_id, client_name, implementation_date, status, completion_percentage, created_at, updated_at) FROM stdin;
5a5b1267-a09e-4034-a045-bc797c64257f	\N	126d0164-d4a5-42a6-a3b8-131ce49d8066	Test Company eXt4G3	2025-11-26 00:00:00	not_started	0	2025-11-28 12:43:51.646619	2025-11-28 12:43:51.646619
51e3a5c2-a38b-4c15-8a91-3a159b394cf1	abcaebf2-319f-4a57-bfdf-eb1925653e2e	30a9a8ad-fb1f-46f2-a003-590dbf93c68c	Test Company Edit	2025-11-25 00:00:00	not_started	0	2025-11-28 12:43:51.646619	2025-11-28 12:43:51.646619
666a522b-f869-4286-97b6-b8940ef48c01	d88a64d8-2328-4d0e-b317-9cfc419ace37	\N	Test Customer t2sQTb	\N	initiation	0	2025-11-28 12:43:51.646619	2025-11-28 12:43:51.646619
be7cffa8-eaa2-4af8-89c3-32a16fc4e85d	\N	b6f3393f-080a-406e-9c03-1eb24dcfb23c	Test Auto-Init Corporation	2025-12-01 00:00:00	not_started	0	2025-11-28 12:43:51.646619	2025-11-28 12:43:51.646619
1cc90753-e1a0-40bd-8224-de352abce728	\N	b6f3393f-080a-406e-9c03-1eb24dcfb23c	Test Transaction Auto-Init Corp	2025-12-15 00:00:00	not_started	0	2025-11-28 12:43:51.646619	2025-11-28 12:43:51.646619
e62c0a6f-1320-4901-9206-104db3274734	abcaebf2-319f-4a57-bfdf-eb1925653e2e	\N	ModuleTest qhZEhu	2025-12-20 10:30:00	not_started	0	2025-11-28 12:43:51.646619	2025-11-28 12:43:51.646619
35bbfdf1-3c16-4ab2-b59a-92e7d7c57719	1f60a117-024e-4457-8e0f-a85a479347d1	7a859167-b4a1-4c10-a895-c01739fd11ca	Sri Bhagavathi Residency	2025-11-27 16:50:00	completed	0	2025-11-28 12:43:51.646619	2025-12-01 18:12:34.312
2483de02-b507-4b7a-bd14-46928008daf9	393d246c-5a79-43ff-9680-7d1775040b84	999de455-f290-4738-833b-99dba51bf115	Microgenn Software Solutions	2025-11-25 18:30:00	completed	0	2025-11-28 12:43:51.646619	2025-12-01 18:12:34.315
\.


--
-- Data for Name: quotes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quotes (id, lead_id, amount, description, status, valid_until, created_at) FROM stdin;
\.


--
-- Data for Name: role_change_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.role_change_history (id, user_id, previous_role_id, new_role_id, changed_by, reason, created_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (sid, sess, expire) FROM stdin;
om7o10Bx4kP467dwhTNehlN00uEfwATV	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-06T05:39:35.629Z", "httpOnly": true, "originalMaxAge": 604800000}, "pendingSignup": {"email": "test@example.com", "lastName": "User", "firstName": "Test", "passwordHash": "$2b$10$BwueCVvhhWQBd81jRUvZceABem1yRoFdaD/DK9LKIZXFiU23tPrhu"}}	2025-12-06 05:39:36
x2cF9SzwLhrh4s1lIkrG4hggCMjvuhr8	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-06T16:22:22.724Z", "httpOnly": true, "originalMaxAge": 604800000}, "pendingSignup": {"email": "snayagamk@gmail.com", "lastName": "User", "firstName": "Test", "passwordHash": "$2b$10$Yfldz7OMrAtTKMrwc77AI.hwnribVHTV240ffmIsNn9hw9gTKaBuS"}}	2025-12-06 16:22:23
zADhKmt8jT5MTx4JCHjNcbKQqMCKpuu0	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-06T09:37:01.142Z", "httpOnly": true, "originalMaxAge": 604800000}, "pendingSignup": {"email": "arun@microgenn.com", "lastName": "Kumar", "firstName": "Arun ", "passwordHash": "$2b$10$HXt6BtSU6iPn3GArZw8Ls.wI3uQcLWvaE./RCduMV5nrJnCwswUjy"}}	2025-12-06 09:37:21
BoRCWp8eSP-2Lldc8fQt0iASYhpbYKzz	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-05T13:20:33.249Z", "httpOnly": true, "originalMaxAge": 604800000}}	2025-12-05 13:20:34
L1EfX1ZPirmbvlbj0sedK1nY_CJ640Yz	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-06T04:56:35.067Z", "httpOnly": true, "originalMaxAge": 604800000}, "userId": "46525611", "isLocalAuth": true}	2025-12-06 16:17:34
Q0VufG2-N5SEI03pnh-S_4as2YhmDO09	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-06T16:45:11.223Z", "httpOnly": true, "originalMaxAge": 604800000}, "pendingSignup": {"email": "snayagamk@gmail.com", "lastName": "User", "firstName": "Test", "passwordHash": "$2b$10$ogO840SQzIUhlHW3krFGo.w/B27Q98.LRYMaX4wL8piHFT9M9bmUe"}}	2025-12-06 16:45:12
0ZfVhpGcWQWufyyBIjrpHa758URBB02D	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-05T13:00:41.338Z", "httpOnly": true, "originalMaxAge": 604800000}, "userId": "46525611", "isLocalAuth": true}	2025-12-05 13:00:42
yatMEKw5S-XoKK8UvJ6NrqwqBye_TC6v	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-06T05:40:08.618Z", "httpOnly": true, "originalMaxAge": 604800000}, "pendingSignup": {"email": "newtest@example.com", "lastName": "Test", "firstName": "New", "passwordHash": "$2b$10$wcMr3RmZMfTjiyTXOeJnoOxSeqjGrmyL6grBZr1IOHQv5FfAuMY5m"}}	2025-12-06 05:40:09
ezz4r5_TgqqlO59KMiBe3cv2-wp427Vi	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-08T04:32:08.252Z", "httpOnly": true, "originalMaxAge": 604800000}, "pendingSignup": {"email": "digitalmarket@microgenn.in", "lastName": "M", "firstName": "Ajith", "passwordHash": "$2b$10$kkBwsN09PYolbOqcRoyB3unEfcbFsssjfiR/Mv43gwDpfw3X9h2UK"}}	2025-12-08 04:32:09
70nzlcRxPBU5jsFtevTVfIRwVWutmUNt	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-06T05:43:41.075Z", "httpOnly": true, "originalMaxAge": 604800000}, "pendingSignup": {"email": "accounts@microgenn.com", "lastName": "User", "firstName": "Test", "passwordHash": "$2b$10$BcdHm5zgNK9lWPqOtOoauuCGonaOjz7p7CYVDDCrR4WH7pRn8JfNO"}}	2025-12-06 05:43:42
FjyKbVpdfEIIToFhTEcgsRIcTNCiQUTV	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-06T05:45:38.149Z", "httpOnly": true, "originalMaxAge": 604800000}, "pendingSignup": {"email": "accounts@microgenn.com", "lastName": "User", "firstName": "Test", "passwordHash": "$2b$10$9p7rOQJoKy3k7sRp78/DDOvp5ujNhOpW5Yr6/X85KMgxysggzFJ0m"}}	2025-12-06 05:45:39
F163JGKkmQ2iRsFXbRVBOmXLSplSgBAT	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-08T17:42:16.863Z", "httpOnly": true, "originalMaxAge": 604800000}, "pendingSignup": {"email": "test-1764610924626@example.com", "lastName": "User", "firstName": "Test", "passwordHash": "$2b$10$sO1W6CF9DgLNTXmRHCV1LON.3Nc4PL34vXZxk7GyfA0J61teMjOau"}}	2025-12-08 17:42:56
XUCPQVLlokGkOWB_5LwvU0GlN3cxsAER	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-06T04:54:20.356Z", "httpOnly": true, "originalMaxAge": 604800000}, "pendingSignup": {"email": "sales@microgenn.com", "lastName": "Ponnuswamy", "firstName": "Padmanaban", "passwordHash": "$2b$10$3qTFs7RUXosFbs4NtL8/OegwZoWPc3YQ7n5QhylpCRBBeXY1aMc9y"}}	2025-12-06 04:54:21
UZ2r55H74QwBWs9W7KzjU7d1xcfVz1Ft	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-08T17:18:52.804Z", "httpOnly": true, "originalMaxAge": 604800000}, "userId": "46525611", "isLocalAuth": true}	2025-12-08 17:22:09
hQ0gx9807xVz1dkkcdeaeYyTyeZFbUJy	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-08T18:22:12.423Z", "httpOnly": true, "originalMaxAge": 604800000}, "userId": "46525611", "isLocalAuth": true}	2025-12-08 18:22:15
RskTLCruzrX7-kOF1mKDFDLuxmLMkK49	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-08T17:52:41.828Z", "httpOnly": true, "originalMaxAge": 604800000}, "userId": "46525611", "isLocalAuth": true}	2025-12-08 17:54:58
VN65MPBSj9wr4DvUmJqwgPI_RMOPlwIK	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-06T05:46:29.567Z", "httpOnly": true, "originalMaxAge": 604800000}, "pendingSignup": {"email": "accounts@microgenn.com", "lastName": "User", "firstName": "Test", "passwordHash": "$2b$10$f4Ev60uqa3U6LmQjUdvTM.CpdKGM4QfHiLxtu8ORrqeUXmRKK4WKS"}}	2025-12-06 05:46:30
pjn1E8ZMxvM_tXzrdbqsX6PtJ1pEtYty	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-05T13:23:51.922Z", "httpOnly": true, "originalMaxAge": 604800000}}	2025-12-05 13:23:57
Qoe9YzWC5C-BGEpfwa3XFnxr8UHgPiuN	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-06T08:40:53.921Z", "httpOnly": true, "originalMaxAge": 604800000}, "pendingSignup": {"email": "snayagamk@gmail.com", "lastName": "User", "firstName": "Test", "passwordHash": "$2b$10$TXWJFC6NvFjEGzfeHTLgmuwvgNCd9pZXaLGVL7OS7qHf9knowSicS"}}	2025-12-06 08:40:54
nsfzG0K1HRj3VOothnaphOlrrErpoe7t	{"cookie": {"path": "/", "secure": true, "expires": "2025-12-09T16:27:10.914Z", "httpOnly": true, "originalMaxAge": 604800000}, "userId": "46525611", "isLocalAuth": true}	2025-12-09 23:58:14
\.


--
-- Data for Name: system_modules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_modules (id, name, display_name, description, icon, sort_order, is_active, created_at) FROM stdin;
25ffdfc0-4d2e-4bc4-a835-7c6655be79b7	dashboard	Dashboard	Main dashboard and analytics	LayoutDashboard	1	t	2025-11-28 12:44:22.831923
b940578c-b24c-417b-9eea-3ca85307d6b9	leads	Sales / Leads	Lead management and sales pipeline	Target	2	t	2025-11-28 12:44:22.831923
5ceece30-dfa8-46ba-b5dc-e5a136990672	quotes	Quotes	Quote generation and management	FileText	3	t	2025-11-28 12:44:22.831923
6dc95aef-6cb1-43f0-ab01-b9750a3b06a5	projects	Implementation	Project implementation tracking	FolderKanban	4	t	2025-11-28 12:44:22.831923
ac885381-c087-46f6-b94f-0cf8ef1ae2a4	tickets	Support Tickets	Customer support ticket management	Ticket	5	t	2025-11-28 12:44:22.831923
967a957a-caa5-4469-b2ac-fde5382d2b72	tasks	Tasks	Task and follow-up management	CheckSquare	6	t	2025-11-28 12:44:22.831923
ad5e69fe-6d42-48d6-b47e-fd940c4588d6	customers	Customers	Customer master data	Users	7	t	2025-11-28 12:44:22.831923
898a165c-2167-4784-98c7-84fecb399e00	reports	Reports	Reports and analytics	BarChart3	8	t	2025-11-28 12:44:22.831923
39f03178-7a1b-438b-a367-09803a1b59d2	user_management	User Management	User, role, and permission management	ShieldCheck	9	t	2025-11-28 12:44:22.831923
a7a7dc0e-4fa6-49e1-bfea-6731d16a5434	settings	Settings	System settings and configuration	Settings	10	t	2025-11-28 12:44:22.831923
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_settings (id, setting_key, setting_value, setting_type, category, description, is_secret, updated_by, created_at, updated_at) FROM stdin;
28dce310-89d7-4df2-84d5-6e4f9ad9d81c	smtp_host	smtp.gmail.com	string	smtp	SMTP server hostname	f	\N	2025-12-01 16:04:29.368072	2025-12-01 16:19:01.966
41c48787-e4eb-485b-8d43-2eaa260384a2	smtp_port	587	number	smtp	SMTP server port	f	\N	2025-12-01 16:04:29.39937	2025-12-01 16:19:01.983
31d8827d-a9b8-4900-89b2-a80d5f7bdac8	smtp_user	snayagamk@gmail.com	string	smtp	SMTP username/email	f	\N	2025-12-01 16:04:29.416289	2025-12-01 16:19:02.003
ac801be6-254a-4439-8ccb-c29099e0a1ad	smtp_pass	isso snep dgve zymd	string	smtp	SMTP password or app password	t	\N	2025-12-01 16:04:29.433568	2025-12-01 16:19:02.017
fdb0aa66-0936-41e7-b003-fba6f1ff4797	smtp_from	snayagamk@gmail.com	string	smtp	From email address	f	\N	2025-12-01 16:04:29.450325	2025-12-01 16:19:02.033
36d6368d-c754-4167-bebc-e00e89da0ede	smtp_secure	false	boolean	smtp	Use SSL/TLS	f	\N	2025-12-01 16:04:29.468175	2025-12-01 16:19:02.049
aacdf67b-14cf-46ac-bcf3-4c78e351da44	smtp_enabled	true	boolean	smtp	Enable SMTP email sending	f	\N	2025-12-01 16:04:29.484878	2025-12-01 16:19:02.064
\.


--
-- Data for Name: task_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.task_comments (id, task_id, user_id, content, voice_note_url, voice_note_duration, mentioned_users, created_at, updated_at) FROM stdin;
ffbaf3b0-970f-4046-8bac-913534c03547	b76f2c43-6ddf-44f6-8d8e-4e5e443cf480	46525611	Not pickup	\N	\N	\N	2025-12-01 13:20:14.392365	2025-12-01 13:20:14.392365
c730d906-88cb-46ac-a34f-2d86cd11f310	b76f2c43-6ddf-44f6-8d8e-4e5e443cf480	46525611	not pickup	\N	\N	\N	2025-12-01 13:20:56.247492	2025-12-01 13:20:56.247492
\.


--
-- Data for Name: task_followups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.task_followups (id, task_id, user_id, followup_type, description, voice_note_url, voice_note_duration, video_url, video_duration, video_thumbnail_url, image_url, next_followup_date, status, created_at) FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tasks (id, title, description, status, priority, created_by, assigned_to, assigned_at, mentioned_users, reminder_date, due_date, voice_note_url, voice_note_duration, attachments, related_entity_type, related_entity_id, completed_at, created_at, updated_at) FROM stdin;
acaa7486-a022-44a3-991b-00cc52132506	Test Task 5Wa0c5	This is a test task created by automated testing	pending	medium	46525611	\N	\N	{}	\N	\N	\N	\N	\N	\N	\N	\N	2025-11-28 12:42:52.999653	2025-11-28 12:42:52.999653
b92c9526-4610-4606-9df3-60377f2400dd	sales team meeting	Every day evening sales team meeting	pending	medium	46525611	test-admin-001	\N	{46525611}	2025-11-25 18:30:00	2025-11-25 18:30:00	\N	\N	\N	\N	\N	\N	2025-11-28 12:42:52.999653	2025-11-28 12:42:52.999653
a4dbcfab-de37-4eff-80fa-c7e8f0f0f02c	Follow up: Microgenn Software Solutions		followup	medium	46525611	46525611	2025-11-28 15:08:03.767	{}	2025-11-28 15:06:00	2025-11-29 15:06:00	/objects//objects/uploads/12f93704-0f22-4734-b1ec-bc477bc1bc43.webm	4	[{"id": "11898a97-bb3c-4cdc-b62d-b2ac728a6df0", "url": "/objects/uploads/3359a507-213c-4be5-80bf-996aa81cb863.png", "name": "MG Logo.png", "size": 759499, "type": "file", "mimeType": "image/png", "createdAt": "2025-11-28T15:07:36.382Z"}, {"id": "b2bd5626-1090-46f4-a279-f7ed89528193", "url": "/objects/uploads/07f5cb88-6c9f-4b60-a6a2-cfb95cd811ab.webm", "name": "Video Recording", "size": 2120770, "type": "video", "duration": 6, "mimeType": "video/webm", "createdAt": "2025-11-28T15:07:59.384Z"}]	lead	999de455-f290-4738-833b-99dba51bf115	\N	2025-11-28 15:08:03.787902	2025-11-28 15:08:03.787902
3af0330f-701e-4c89-86b0-3cabd35cfb2f	Follow up: Microgenn Software Solutions		followup	medium	46525611	46525611	2025-11-28 15:08:06.425	{}	2025-11-28 15:06:00	2025-11-29 15:06:00	/objects//objects/uploads/1191d7e0-10c4-4387-8317-70d81e74afc0.webm	4	[{"id": "11898a97-bb3c-4cdc-b62d-b2ac728a6df0", "url": "/objects/uploads/3359a507-213c-4be5-80bf-996aa81cb863.png", "name": "MG Logo.png", "size": 759499, "type": "file", "mimeType": "image/png", "createdAt": "2025-11-28T15:07:36.382Z"}, {"id": "ae2700b7-d1ee-4ef7-a5d3-1a7a1277d3a4", "url": "/objects/uploads/7255e1df-2a9f-4138-9df7-b7f66346972c.webm", "name": "Video Recording", "size": 2120770, "type": "video", "duration": 6, "mimeType": "video/webm", "createdAt": "2025-11-28T15:08:02.014Z"}]	lead	999de455-f290-4738-833b-99dba51bf115	\N	2025-11-28 15:08:06.443517	2025-11-28 15:08:06.443517
b76f2c43-6ddf-44f6-8d8e-4e5e443cf480	Follow up: Microgenn Software Solutions		followup	medium	46525611	46525611	2025-11-28 15:08:08.656	{}	2025-11-28 15:06:00	2025-11-29 15:06:00	/objects//objects/uploads/dd1e2a6d-f076-4da8-90e7-ac319adc9912.webm	4	[{"id": "11898a97-bb3c-4cdc-b62d-b2ac728a6df0", "url": "/objects/uploads/3359a507-213c-4be5-80bf-996aa81cb863.png", "name": "MG Logo.png", "size": 759499, "type": "file", "mimeType": "image/png", "createdAt": "2025-11-28T15:07:36.382Z"}, {"id": "389ae33c-9fbf-453c-9362-2bcb8d5aee25", "url": "/objects/uploads/0650392a-e2b8-463e-820f-63a50e8e88b4.webm", "name": "Video Recording", "size": 2120770, "type": "video", "duration": 6, "mimeType": "video/webm", "createdAt": "2025-11-28T15:08:04.247Z"}]	lead	999de455-f290-4738-833b-99dba51bf115	\N	2025-11-28 15:08:08.674194	2025-11-28 15:08:08.674194
9cd785b6-4e1b-411b-9181-d47068e68ae9	Test Task NaCOfv		pending	medium	46525611	test-admin-001	2025-12-01 17:20:51.977	{}	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-01 17:20:51.988354	2025-12-01 17:20:51.988354
\.


--
-- Data for Name: ticket_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ticket_comments (id, ticket_id, user_id, comment, is_internal, created_at) FROM stdin;
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tickets (id, ticket_number, customer_id, project_id, module_id, customer_name, customer_email, customer_phone, issue_summary, issue_description, attachments, priority, status, assigned_engineer_id, escalation_level, escalated_at, closed_at, reopened_from_ticket_id, reopen_reason, reopened_at, feedback_status, feedback_sent_at, created_at, updated_at) FROM stdin;
249064bb-e015-4b1d-9865-f41ef488e7a9	TKT-000001	\N	\N	\N	Jane Doe	jane@customer.com	\N	Login issues after password reset	Cannot log in after resetting password via email link	\N	high	open	\N	1	\N	\N	\N	\N	\N	pending	\N	2025-11-28 12:44:01.499369	2025-11-28 12:44:01.499369
eba7e202-6aa5-4719-88d2-8ee58e018221	TKT-000002	abcaebf2-319f-4a57-bfdf-eb1925653e2e	\N	050433df-643a-4c80-9815-045b0a1f0a05	ModuleTest qhZEhu	moduletest@example.com	\N	Test issue for Front Office module	This is a test ticket to verify module selection works correctly	\N	high	open	\N	1	\N	\N	\N	\N	\N	pending	\N	2025-11-28 12:44:01.499369	2025-11-28 12:44:01.499369
d54287a0-405c-484e-9b23-623bf065b3b9	TKT-000003	abcaebf2-319f-4a57-bfdf-eb1925653e2e	\N	e1504acd-12c8-41d2-9661-7035ce94ed7d	ModuleTest qhZEhu	moduletest@example.com	\N	POS checkout not working	Customer reports checkout screen freezes when scanning items	\N	critical	closed	\N	3	\N	2025-12-01 18:43:22.079	\N	\N	\N	pending	\N	2025-11-28 12:44:01.499369	2025-12-01 18:43:22.079
a9fccb62-9532-4d4c-9222-acd81df97fef	TKT-000004	abcaebf2-319f-4a57-bfdf-eb1925653e2e	\N	e1504acd-12c8-41d2-9661-7035ce94ed7d	ModuleTest qhZEhu	moduletest@example.com	\N	[REOPENED] POS checkout not working	As per customer feed back	\N	critical	open	\N	1	\N	\N	d54287a0-405c-484e-9b23-623bf065b3b9	As per customer feed back	2025-12-01 18:43:42.713	pending	\N	2025-12-01 18:43:42.736181	2025-12-01 18:43:42.736181
\.


--
-- Data for Name: training_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.training_records (id, project_id, module_id, training_session_id, recipient_name, training_hours, training_date, notes, created_at) FROM stdin;
\.


--
-- Data for Name: training_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.training_sessions (id, project_id, module_id, assigned_engineer_id, recipient_name, recipient_email, recipient_department, scheduled_date, scheduled_hours, status, completed_at, notes, created_at, updated_at) FROM stdin;
aecaa538-95b6-4795-8a8e-a588f96e8282	2483de02-b507-4b7a-bd14-46928008daf9	050433df-643a-4c80-9815-045b0a1f0a05	\N	Suresh	\N	\N	2025-11-26 14:30:00	2	completed	\N	\N	2025-11-28 12:45:01.442939	2025-11-28 12:45:01.442939
fdb70b2f-9a4b-4ea2-a94e-15dcb304c87e	35bbfdf1-3c16-4ab2-b59a-92e7d7c57719	050433df-643a-4c80-9815-045b0a1f0a05	\N	Mr.kumar	\N	\N	2025-11-27 22:23:00	2	scheduled	\N	\N	2025-11-28 12:45:01.442939	2025-11-28 12:45:01.442939
1776428d-a851-4aa3-8aec-62f6ce06183a	35bbfdf1-3c16-4ab2-b59a-92e7d7c57719	9996e94c-2c5d-4c36-a499-38c5d1e68c01	\N	kumar	\N	\N	2025-11-27 22:24:00	2	scheduled	\N	\N	2025-11-28 12:45:01.442939	2025-11-28 12:45:01.442939
e417ca23-e737-4fc8-bb16-f15d546328a0	35bbfdf1-3c16-4ab2-b59a-92e7d7c57719	7f49d048-a309-4960-8d01-be6d95fdf924	\N	kumar	\N	\N	2025-11-27 22:24:00	2	scheduled	\N	\N	2025-11-28 12:45:01.442939	2025-11-28 12:45:01.442939
\.


--
-- Data for Name: user_module_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_module_permissions (id, user_id, module_id, can_view, can_create, can_edit, can_delete, granted_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_point_balances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_point_balances (id, user_id, total_points, lead_points, task_points, ticket_points, project_points, updated_at) FROM stdin;
\.


--
-- Data for Name: user_point_ledger; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_point_ledger (id, user_id, module_type, entity_id, category_id, action, points, reason, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: user_role_assignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_role_assignments (id, user_id, role_id, is_primary, assigned_by, assigned_at, is_active) FROM stdin;
\.


--
-- Data for Name: user_role_rights; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_role_rights (id, role_id, module, can_view, can_create, can_edit, can_delete, created_at, updated_at) FROM stdin;
1b7026ab-3658-46db-b02d-39e729848201	e6494264-b679-4b98-a062-ec2d048537c9	25ffdfc0-4d2e-4bc4-a835-7c6655be79b7	t	f	f	f	2025-11-28 12:58:54.832022	2025-11-28 12:59:13.339
2ce81296-a71c-4adc-959d-92c6318d42d3	e6494264-b679-4b98-a062-ec2d048537c9	b940578c-b24c-417b-9eea-3ca85307d6b9	t	f	f	f	2025-11-28 12:58:54.856635	2025-11-28 12:59:13.362
842c4471-fe2a-4978-b7ff-5e9c51969af5	e6494264-b679-4b98-a062-ec2d048537c9	5ceece30-dfa8-46ba-b5dc-e5a136990672	f	f	f	f	2025-11-28 12:58:54.873091	2025-11-28 12:59:13.382
8d3e9116-2e2e-4368-90ce-814d8ce110be	e6494264-b679-4b98-a062-ec2d048537c9	6dc95aef-6cb1-43f0-ab01-b9750a3b06a5	f	f	t	t	2025-11-28 12:58:54.890003	2025-11-28 12:59:13.402
56fb77b7-8635-4773-807c-4d28cd3a75a7	e6494264-b679-4b98-a062-ec2d048537c9	ac885381-c087-46f6-b94f-0cf8ef1ae2a4	f	f	f	f	2025-11-28 12:58:54.905821	2025-11-28 12:59:13.422
ee2e4b37-ed6e-435f-83cf-c8c806e19622	e6494264-b679-4b98-a062-ec2d048537c9	967a957a-caa5-4469-b2ac-fde5382d2b72	f	f	f	f	2025-11-28 12:58:54.921828	2025-11-28 12:59:13.444
e4a275ad-6aef-4614-a6df-ed4eef3c489f	e6494264-b679-4b98-a062-ec2d048537c9	ad5e69fe-6d42-48d6-b47e-fd940c4588d6	f	f	f	f	2025-11-28 12:58:54.937825	2025-11-28 12:59:13.464
e1532649-2b8e-4ec9-8a9a-3b0664e80848	e6494264-b679-4b98-a062-ec2d048537c9	898a165c-2167-4784-98c7-84fecb399e00	f	f	f	f	2025-11-28 12:58:54.9574	2025-11-28 12:59:13.483
359ce6f6-d95f-43fd-832e-aff653233d68	e6494264-b679-4b98-a062-ec2d048537c9	39f03178-7a1b-438b-a367-09803a1b59d2	f	f	f	f	2025-11-28 12:58:54.972665	2025-11-28 12:59:13.503
99539e17-6877-4025-9d6a-9a4f3d32a00f	e6494264-b679-4b98-a062-ec2d048537c9	a7a7dc0e-4fa6-49e1-bfea-6731d16a5434	f	f	f	f	2025-11-28 12:58:54.988035	2025-11-28 12:59:13.522
72c42e49-71e0-4989-bdd1-4e420c0b4f88	d6dafb1a-573d-4e04-b637-a147b03973ae	25ffdfc0-4d2e-4bc4-a835-7c6655be79b7	f	t	f	f	2025-11-28 12:59:58.514371	2025-11-28 12:59:58.514371
022e42f4-61c8-4540-9583-375d75fc9fce	d6dafb1a-573d-4e04-b637-a147b03973ae	b940578c-b24c-417b-9eea-3ca85307d6b9	f	t	f	f	2025-11-28 12:59:58.540241	2025-11-28 12:59:58.540241
61f68320-3e03-47df-b902-0247db8e51f0	d6dafb1a-573d-4e04-b637-a147b03973ae	5ceece30-dfa8-46ba-b5dc-e5a136990672	f	t	f	f	2025-11-28 12:59:58.557795	2025-11-28 12:59:58.557795
4dec5004-a9b4-4316-9c77-fe1ea6ad8b11	d6dafb1a-573d-4e04-b637-a147b03973ae	6dc95aef-6cb1-43f0-ab01-b9750a3b06a5	f	t	f	f	2025-11-28 12:59:58.574021	2025-11-28 12:59:58.574021
5a10740f-d360-4a8f-8707-ccbc4f8faa72	d6dafb1a-573d-4e04-b637-a147b03973ae	ac885381-c087-46f6-b94f-0cf8ef1ae2a4	f	t	f	f	2025-11-28 12:59:58.590758	2025-11-28 12:59:58.590758
9dbd29b9-fa74-4d14-a8a3-9613e5d472c3	d6dafb1a-573d-4e04-b637-a147b03973ae	967a957a-caa5-4469-b2ac-fde5382d2b72	f	t	f	f	2025-11-28 12:59:58.607237	2025-11-28 12:59:58.607237
83f7143e-fb69-4d4b-ba0f-9d7b4e9865e4	d6dafb1a-573d-4e04-b637-a147b03973ae	ad5e69fe-6d42-48d6-b47e-fd940c4588d6	f	t	f	f	2025-11-28 12:59:58.623641	2025-11-28 12:59:58.623641
3e3198c5-95e8-43a9-862f-74c8880f0d99	d6dafb1a-573d-4e04-b637-a147b03973ae	898a165c-2167-4784-98c7-84fecb399e00	f	t	f	f	2025-11-28 12:59:58.63992	2025-11-28 12:59:58.63992
e1fd629c-9887-4eb1-9b37-bc5cd7b10862	d6dafb1a-573d-4e04-b637-a147b03973ae	39f03178-7a1b-438b-a367-09803a1b59d2	f	t	f	f	2025-11-28 12:59:58.656217	2025-11-28 12:59:58.656217
3dc654dc-0022-4fef-b9d0-0701ab115f16	d6dafb1a-573d-4e04-b637-a147b03973ae	a7a7dc0e-4fa6-49e1-bfea-6731d16a5434	f	t	f	f	2025-11-28 12:59:58.673899	2025-11-28 12:59:58.673899
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (id, name, display_name, description, is_active, created_at, updated_at) FROM stdin;
d6dafb1a-573d-4e04-b637-a147b03973ae	deve	Developer Trainee	Developer Trainee web	t	2025-11-28 12:44:07.757428	2025-11-28 12:44:07.757428
9cbf2dac-00dd-4864-83ca-d2a51986a68d	engineer	Engineer	A test manager role	t	2025-11-28 12:44:07.757428	2025-11-28 12:44:07.757428
e6494264-b679-4b98-a062-ec2d048537c9	technical_support_engineer	Tech Support	technical support	t	2025-11-28 12:44:07.757428	2025-11-28 12:44:07.757428
6b6278c8-4d11-4b76-a742-ac7e3b9a311e	sales_head	Sales Head	Head of sales	t	2025-11-28 16:02:42.942258	2025-11-28 16:02:42.942258
4a6d9690-6440-4e38-8d31-e68cfebb0f99	salesexe	Business Developement Manager	Sales Executive	t	2025-11-28 12:44:07.757428	2025-11-28 16:03:02.219
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, first_name, last_name, profile_image_url, role, password_hash, is_email_verified, is_active, is_approved, approved_by, approved_at, auth_provider, last_login_at, impersonated_by, created_at, updated_at, department_id) FROM stdin;
test-admin-001	admin@microgenn.com	Admin	User	\N	sales_executive	\N	f	t	f	\N	\N	local	\N	\N	2025-11-28 12:41:32.039302	2025-11-28 12:41:32.039302	\N
test-sales-8PJPaV	sales-test@example.com	Sales	Rep	\N	salesexe	\N	f	t	f	\N	\N	local	\N	\N	2025-11-28 12:41:32.039302	2025-11-28 12:41:32.039302	\N
test-user-FWb4Ps	testuserEkHYkg@example.com	Test	User	\N	engineer	\N	f	t	f	\N	\N	local	\N	\N	2025-11-28 12:41:32.039302	2025-11-28 12:41:32.039302	\N
test-user-hGkYOT	testuser1BAceB@example.com	Test	User	\N	engineer	\N	f	t	f	\N	\N	local	\N	\N	2025-11-28 12:41:32.039302	2025-11-28 12:41:32.039302	\N
admin-revoke-xGZyDe	admin-revoke-Osbhgr@example.com	Admin	Tester	\N	admin	\N	f	t	f	\N	\N	local	\N	\N	2025-11-28 12:41:32.039302	2025-11-28 12:41:32.039302	\N
sales_user_abc123	sales_test@example.com	Santhosh	Sales	\N	sales_executive	\N	f	t	t	46525611	2025-11-28 13:22:51.96	local	\N	\N	2025-11-28 12:41:32.039302	2025-11-28 13:22:51.96	\N
63f037af-1a62-4cc9-9dd6-c018eebbc377	snayagamk@gmail.com	Naveen	Kumar	\N	support	\N	f	t	f	46525611	2025-11-28 16:01:34.493	local	\N	\N	2025-11-28 12:41:32.039302	2025-11-29 05:31:39.94	\N
46525611	senthil@microgenn.com	NIRMALA	NAYAGAM	\N	admin	$2b$10$jvCCZqFcHan6V2skxjDXMufVXZtNxD/Nia5pZdh7XH57vb/.5pWBC	t	t	t	\N	\N	local	2025-12-02 16:27:10.887	\N	2025-11-28 12:41:32.039302	2025-12-02 16:27:10.887	\N
\.


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: demo_date_history demo_date_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demo_date_history
    ADD CONSTRAINT demo_date_history_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_unique UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: escalation_history escalation_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalation_history
    ADD CONSTRAINT escalation_history_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: follow_ups follow_ups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base_chunks knowledge_base_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_chunks
    ADD CONSTRAINT knowledge_base_chunks_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base_queries knowledge_base_queries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_queries
    ADD CONSTRAINT knowledge_base_queries_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base_sources knowledge_base_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_sources
    ADD CONSTRAINT knowledge_base_sources_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: modules modules_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_name_unique UNIQUE (name);


--
-- Name: modules modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_pkey PRIMARY KEY (id);


--
-- Name: negotiation_date_history negotiation_date_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negotiation_date_history
    ADD CONSTRAINT negotiation_date_history_pkey PRIMARY KEY (id);


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_pkey PRIMARY KEY (id);


--
-- Name: planning_change_logs planning_change_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_change_logs
    ADD CONSTRAINT planning_change_logs_pkey PRIMARY KEY (id);


--
-- Name: point_categories point_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_categories
    ADD CONSTRAINT point_categories_pkey PRIMARY KEY (id);


--
-- Name: point_category_department_settings point_category_department_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_category_department_settings
    ADD CONSTRAINT point_category_department_settings_pkey PRIMARY KEY (id);


--
-- Name: project_engineers project_engineers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_engineers
    ADD CONSTRAINT project_engineers_pkey PRIMARY KEY (id);


--
-- Name: project_handoffs project_handoffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_handoffs
    ADD CONSTRAINT project_handoffs_pkey PRIMARY KEY (id);


--
-- Name: project_modules project_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_modules
    ADD CONSTRAINT project_modules_pkey PRIMARY KEY (id);


--
-- Name: project_progress_entries project_progress_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_progress_entries
    ADD CONSTRAINT project_progress_entries_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: role_change_history role_change_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_change_history
    ADD CONSTRAINT role_change_history_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: system_modules system_modules_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_modules
    ADD CONSTRAINT system_modules_name_unique UNIQUE (name);


--
-- Name: system_modules system_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_modules
    ADD CONSTRAINT system_modules_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_setting_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_setting_key_unique UNIQUE (setting_key);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: task_followups task_followups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_followups
    ADD CONSTRAINT task_followups_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: ticket_comments ticket_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_ticket_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ticket_number_unique UNIQUE (ticket_number);


--
-- Name: training_records training_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_records
    ADD CONSTRAINT training_records_pkey PRIMARY KEY (id);


--
-- Name: training_sessions training_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_module_permissions user_module_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_module_permissions
    ADD CONSTRAINT user_module_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_point_balances user_point_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_point_balances
    ADD CONSTRAINT user_point_balances_pkey PRIMARY KEY (id);


--
-- Name: user_point_balances user_point_balances_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_point_balances
    ADD CONSTRAINT user_point_balances_user_id_unique UNIQUE (user_id);


--
-- Name: user_point_ledger user_point_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_point_ledger
    ADD CONSTRAINT user_point_ledger_pkey PRIMARY KEY (id);


--
-- Name: user_role_assignments user_role_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_pkey PRIMARY KEY (id);


--
-- Name: user_role_rights user_role_rights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_rights
    ADD CONSTRAINT user_role_rights_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_name_unique UNIQUE (name);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: knowledge_base_chunks_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_base_chunks_embedding_idx ON public.knowledge_base_chunks USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: activity_log activity_log_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: attachments attachments_uploaded_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_uploaded_by_users_id_fk FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: demo_date_history demo_date_history_changed_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demo_date_history
    ADD CONSTRAINT demo_date_history_changed_by_id_users_id_fk FOREIGN KEY (changed_by_id) REFERENCES public.users(id);


--
-- Name: demo_date_history demo_date_history_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demo_date_history
    ADD CONSTRAINT demo_date_history_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: departments departments_manager_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_manager_id_users_id_fk FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: escalation_history escalation_history_escalated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalation_history
    ADD CONSTRAINT escalation_history_escalated_by_users_id_fk FOREIGN KEY (escalated_by) REFERENCES public.users(id);


--
-- Name: escalation_history escalation_history_ticket_id_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escalation_history
    ADD CONSTRAINT escalation_history_ticket_id_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: feedback feedback_ticket_id_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_ticket_id_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: follow_ups follow_ups_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT follow_ups_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: knowledge_base_chunks knowledge_base_chunks_source_id_knowledge_base_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_chunks
    ADD CONSTRAINT knowledge_base_chunks_source_id_knowledge_base_sources_id_fk FOREIGN KEY (source_id) REFERENCES public.knowledge_base_sources(id) ON DELETE CASCADE;


--
-- Name: knowledge_base_queries knowledge_base_queries_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_queries
    ADD CONSTRAINT knowledge_base_queries_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: knowledge_base_sources knowledge_base_sources_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_sources
    ADD CONSTRAINT knowledge_base_sources_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: leads leads_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: leads leads_sales_executive_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_sales_executive_id_users_id_fk FOREIGN KEY (sales_executive_id) REFERENCES public.users(id);


--
-- Name: negotiation_date_history negotiation_date_history_changed_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negotiation_date_history
    ADD CONSTRAINT negotiation_date_history_changed_by_id_users_id_fk FOREIGN KEY (changed_by_id) REFERENCES public.users(id);


--
-- Name: negotiation_date_history negotiation_date_history_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negotiation_date_history
    ADD CONSTRAINT negotiation_date_history_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: planning_change_logs planning_change_logs_changed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_change_logs
    ADD CONSTRAINT planning_change_logs_changed_by_users_id_fk FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: planning_change_logs planning_change_logs_new_engineer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_change_logs
    ADD CONSTRAINT planning_change_logs_new_engineer_id_users_id_fk FOREIGN KEY (new_engineer_id) REFERENCES public.users(id);


--
-- Name: planning_change_logs planning_change_logs_old_engineer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_change_logs
    ADD CONSTRAINT planning_change_logs_old_engineer_id_users_id_fk FOREIGN KEY (old_engineer_id) REFERENCES public.users(id);


--
-- Name: planning_change_logs planning_change_logs_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_change_logs
    ADD CONSTRAINT planning_change_logs_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: planning_change_logs planning_change_logs_project_module_id_project_modules_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_change_logs
    ADD CONSTRAINT planning_change_logs_project_module_id_project_modules_id_fk FOREIGN KEY (project_module_id) REFERENCES public.project_modules(id) ON DELETE CASCADE;


--
-- Name: point_categories point_categories_department_id_departments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_categories
    ADD CONSTRAINT point_categories_department_id_departments_id_fk FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: point_category_department_settings point_category_department_settings_point_category_id_point_cate; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_category_department_settings
    ADD CONSTRAINT point_category_department_settings_point_category_id_point_cate FOREIGN KEY (point_category_id) REFERENCES public.point_categories(id) ON DELETE CASCADE;


--
-- Name: project_engineers project_engineers_engineer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_engineers
    ADD CONSTRAINT project_engineers_engineer_id_users_id_fk FOREIGN KEY (engineer_id) REFERENCES public.users(id);


--
-- Name: project_engineers project_engineers_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_engineers
    ADD CONSTRAINT project_engineers_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_handoffs project_handoffs_handoff_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_handoffs
    ADD CONSTRAINT project_handoffs_handoff_by_id_users_id_fk FOREIGN KEY (handoff_by_id) REFERENCES public.users(id);


--
-- Name: project_handoffs project_handoffs_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_handoffs
    ADD CONSTRAINT project_handoffs_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_modules project_modules_actual_engineer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_modules
    ADD CONSTRAINT project_modules_actual_engineer_id_users_id_fk FOREIGN KEY (actual_engineer_id) REFERENCES public.users(id);


--
-- Name: project_modules project_modules_assigned_engineer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_modules
    ADD CONSTRAINT project_modules_assigned_engineer_id_users_id_fk FOREIGN KEY (assigned_engineer_id) REFERENCES public.users(id);


--
-- Name: project_modules project_modules_module_id_modules_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_modules
    ADD CONSTRAINT project_modules_module_id_modules_id_fk FOREIGN KEY (module_id) REFERENCES public.modules(id);


--
-- Name: project_modules project_modules_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_modules
    ADD CONSTRAINT project_modules_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_progress_entries project_progress_entries_engineer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_progress_entries
    ADD CONSTRAINT project_progress_entries_engineer_id_users_id_fk FOREIGN KEY (engineer_id) REFERENCES public.users(id);


--
-- Name: project_progress_entries project_progress_entries_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_progress_entries
    ADD CONSTRAINT project_progress_entries_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projects projects_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: projects projects_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: quotes quotes_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: role_change_history role_change_history_changed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_change_history
    ADD CONSTRAINT role_change_history_changed_by_users_id_fk FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: role_change_history role_change_history_new_role_id_user_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_change_history
    ADD CONSTRAINT role_change_history_new_role_id_user_roles_id_fk FOREIGN KEY (new_role_id) REFERENCES public.user_roles(id);


--
-- Name: role_change_history role_change_history_previous_role_id_user_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_change_history
    ADD CONSTRAINT role_change_history_previous_role_id_user_roles_id_fk FOREIGN KEY (previous_role_id) REFERENCES public.user_roles(id);


--
-- Name: role_change_history role_change_history_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_change_history
    ADD CONSTRAINT role_change_history_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: system_settings system_settings_updated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: task_comments task_comments_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: task_followups task_followups_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_followups
    ADD CONSTRAINT task_followups_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_followups task_followups_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_followups
    ADD CONSTRAINT task_followups_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tasks tasks_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: tasks tasks_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ticket_comments ticket_comments_ticket_id_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_ticket_id_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_comments ticket_comments_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tickets tickets_assigned_engineer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assigned_engineer_id_users_id_fk FOREIGN KEY (assigned_engineer_id) REFERENCES public.users(id);


--
-- Name: tickets tickets_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: tickets tickets_module_id_modules_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_module_id_modules_id_fk FOREIGN KEY (module_id) REFERENCES public.modules(id);


--
-- Name: tickets tickets_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: training_records training_records_module_id_modules_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_records
    ADD CONSTRAINT training_records_module_id_modules_id_fk FOREIGN KEY (module_id) REFERENCES public.modules(id);


--
-- Name: training_records training_records_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_records
    ADD CONSTRAINT training_records_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: training_records training_records_training_session_id_training_sessions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_records
    ADD CONSTRAINT training_records_training_session_id_training_sessions_id_fk FOREIGN KEY (training_session_id) REFERENCES public.training_sessions(id);


--
-- Name: training_sessions training_sessions_assigned_engineer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_assigned_engineer_id_users_id_fk FOREIGN KEY (assigned_engineer_id) REFERENCES public.users(id);


--
-- Name: training_sessions training_sessions_module_id_modules_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_module_id_modules_id_fk FOREIGN KEY (module_id) REFERENCES public.modules(id);


--
-- Name: training_sessions training_sessions_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: user_module_permissions user_module_permissions_granted_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_module_permissions
    ADD CONSTRAINT user_module_permissions_granted_by_users_id_fk FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: user_module_permissions user_module_permissions_module_id_system_modules_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_module_permissions
    ADD CONSTRAINT user_module_permissions_module_id_system_modules_id_fk FOREIGN KEY (module_id) REFERENCES public.system_modules(id) ON DELETE CASCADE;


--
-- Name: user_module_permissions user_module_permissions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_module_permissions
    ADD CONSTRAINT user_module_permissions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_point_balances user_point_balances_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_point_balances
    ADD CONSTRAINT user_point_balances_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_point_ledger user_point_ledger_category_id_point_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_point_ledger
    ADD CONSTRAINT user_point_ledger_category_id_point_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.point_categories(id);


--
-- Name: user_point_ledger user_point_ledger_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_point_ledger
    ADD CONSTRAINT user_point_ledger_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: user_point_ledger user_point_ledger_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_point_ledger
    ADD CONSTRAINT user_point_ledger_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_role_assignments user_role_assignments_assigned_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_assigned_by_users_id_fk FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_role_assignments user_role_assignments_role_id_user_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_role_id_user_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;


--
-- Name: user_role_assignments user_role_assignments_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_role_rights user_role_rights_role_id_user_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_rights
    ADD CONSTRAINT user_role_rights_role_id_user_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict p39y2PtfIIvIOChCR0NXjbrP4ERgKYcqnFh25Ie7SQxq0E5MxRFCZy7mtNB0BHX

