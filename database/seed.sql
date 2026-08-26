-- Seed Data for SkillSetu (MoSPI SIH26101 Demo)

-- Users
INSERT OR REPLACE INTO users (id, email, password_hash, role) VALUES
('u-official-001', 'official@skillsetu.demo', 'demo_hash_official', 'OFFICIAL'),
('u-trainer-001', 'trainer@skillsetu.demo', 'demo_hash_trainer', 'TRAINER'),
('u-admin-001', 'admin@skillsetu.demo', 'demo_hash_admin', 'ADMIN');

-- Profiles
INSERT OR REPLACE INTO profiles (id, user_id, full_name, designation, department, job_role, current_assignment, educational_qualification, previous_trainings, experience_years) VALUES
('p-official-001', 'u-official-001', 'Ananya Sharma', 'Statistical Officer', 'Ministry of Statistics and Programme Implementation (MoSPI DIID)', 'Senior Data Analyst & Field Survey Coordinator', 'National Sample Survey 80th Round (Socio-Economic Survey)', 'M.Sc. Statistics (Delhi University)', '["NSSO Field Enumeration Workshop", "Introduction to R for Official Statistics"]', 6),
('p-trainer-001', 'u-trainer-001', 'Dr. V. K. Rao', 'Senior Faculty', 'National Statistical Systems Training Academy (NSSTA)', 'Lead Instructor - Statistical Inference', 'TPAC Curriculum Advisory & Executive Training', 'Ph.D. Econometrics (ISI Kolkata)', '["Advanced Survey Methodology", "iGOT Content Authoring Certification"]', 14),
('p-admin-001', 'u-admin-001', 'Rajesh Kumar', 'Director & Division Head', 'Data Informatics & Innovation Division (DIID MoSPI)', 'Strategic Capacity Director', 'National Data & Analytics Platform (NDAP) Oversight', 'M.Tech Computer Science & Post-Grad Statistics', '["National E-Governance Leadership Programme", "Public Policy & Data Strategy"]', 18);

-- Competencies across 4 Domains
INSERT OR REPLACE INTO competencies (id, domain, name, description) VALUES
('comp-stat-001', 'Statistical Competencies', 'Statistical Methods & Inference', 'Principles of statistical inference, hypothesis testing, and probability distributions.'),
('comp-stat-002', 'Statistical Competencies', 'Survey Design & Sampling Methods', 'Stratified sampling, cluster sampling, non-sampling errors, and sample weight adjustments.'),
('comp-stat-003', 'Statistical Competencies', 'National Accounts & Price Statistics', 'CPI/WPI computation, Gross Domestic Product estimation, and macroeconomic indicators.'),
('comp-tech-001', 'Technical Competencies', 'Data Analysis & Python/R', 'Exploratory data analysis using Pandas, R, and automated statistical processing.'),
('comp-tech-002', 'Technical Competencies', 'Official Statistics & Data Visualization', 'Standard metadata frameworks, dashboards, GIS mapping, and open data standards.'),
('comp-gov-001', 'Digital Governance', 'Data Privacy & Cybersecurity', 'Government Data Privacy Guidelines, Digital Personal Data Protection Act, and security.'),
('comp-mgr-001', 'Behavioural & Managerial', 'Public Leadership & Communication', 'Project management in statistical surveys, inter-departmental collaboration, and reporting.');

-- Pre-approved Assessment Questions
INSERT OR REPLACE INTO questions (id, document_id, competency_id, question_text, options_json, correct_option, explanation, difficulty, review_status, source_reference) VALUES
('q-001', NULL, 'comp-stat-001', 'In hypothesis testing, what occurs during a Type I error?', '["Accepting a false null hypothesis", "Rejecting a true null hypothesis", "Calculating incorrect sample size", "Using parametric tests on non-normal data"]', 1, 'Type I error occurs when the null hypothesis is true, but is incorrectly rejected.', 'medium', 'APPROVED', 'MoSPI Manual Ch. 2'),
('q-002', NULL, 'comp-stat-001', 'Which measure of central tendency is least affected by extreme outliers?', '["Arithmetic Mean", "Median", "Standard Deviation", "Variance"]', 1, 'Median is resistant to outliers because it relies on positional rank rather than exact values.', 'easy', 'APPROVED', 'MoSPI Manual Ch. 1'),
('q-003', NULL, 'comp-stat-002', 'In National Sample Survey (NSS) design, why is Stratified Random Sampling primarily preferred?', '["It completely eliminates non-sampling errors", "It ensures proportional representation across heterogeneous sub-populations", "It is cheaper than simple random sampling", "It eliminates the need for sampling weights"]', 1, 'Stratification reduces sampling variance by dividing a population into homogeneous strata.', 'hard', 'APPROVED', 'NSSO Sampling Design Guide'),
('q-004', NULL, 'comp-stat-002', 'What does the design effect (Deff) in complex survey sampling evaluate?', '["The ratio of sampling error to non-sampling error", "The variance under complex sampling relative to simple random sampling", "The cost effectiveness of field enumeration", "The response rate percentage"]', 1, 'Deff measures the ratio of the variance of an estimator under a complex sampling design to the variance under Simple Random Sampling.', 'hard', 'APPROVED', 'NSSO Sampling Design Guide'),
('q-005', NULL, 'comp-stat-003', 'Which index formula is currently used for computing the Consumer Price Index (CPI) in India?', '["Laspeyres Price Index", "Paasche Price Index", "Fisher Ideal Index", "Marshall-Edgeworth Index"]', 0, 'India CPI uses a modified Laspeyres formula with base-year weighting.', 'medium', 'APPROVED', 'MoSPI Price Statistics Division'),
('q-006', NULL, 'comp-tech-001', 'Which Python library is standard for handling tabular statistical data structures (DataFrames)?', '["NumPy", "Pandas", "SciPy", "Matplotlib"]', 1, 'Pandas provides primary DataFrame data structures for statistical analysis.', 'easy', 'APPROVED', 'MoSPI Tech Upskilling Module'),
('q-007', NULL, 'comp-tech-001', 'What is the main advantage of using SQL window functions like ROW_NUMBER() over GROUP BY in statistical queries?', '["SQL window functions execute 10x faster", "Window functions preserve individual row details while computing aggregate metrics", "Window functions can only be used with numeric columns", "GROUP BY removes duplicate primary keys"]', 1, 'Window functions compute aggregated values across a set of rows while keeping original row identities intact.', 'medium', 'APPROVED', 'MoSPI Data Management System'),
('q-008', NULL, 'comp-tech-002', 'What is the primary purpose of SDMX (Statistical Data and Metadata eXchange)?', '["To encrypt official survey microdata", "To standardize exchange of statistical data and metadata across national agencies", "To automate field enumeration using GPS", "To compress large census files"]', 1, 'SDMX is an international standard designed to streamline statistical data and metadata exchange.', 'hard', 'APPROVED', 'UN & MoSPI Metadata Guidelines'),
('q-009', NULL, 'comp-gov-001', 'Under the Digital Personal Data Protection (DPDP) Act, what is required before processing personal survey data?', '["Prior written approval from NITI Aayog", "Clear, informed consent or lawful public mandate", "Biometric verification of all respondents", "Encryption using 4096-bit keys"]', 1, 'Processing personal data requires informed consent or explicit statutory authorization.', 'medium', 'APPROVED', 'Digital Governance Framework'),
('q-010', NULL, 'comp-mgr-001', 'In project management for large-scale field surveys, what does Critical Path Method (CPM) identify?', '["The survey domain with highest non-response rate", "The sequence of dependent tasks that determines minimum total project duration", "The total financial budget allocation", "The quality control audit frequency"]', 1, 'The critical path determines the shortest possible time to complete a project without delays.', 'medium', 'APPROVED', 'NSSTA Management Module');

-- Seed Historical Quiz Attempt & Results for Ananya Sharma
INSERT OR REPLACE INTO quiz_attempts (id, user_id, total_questions, correct_answers, overall_score, completed_at) VALUES
('att-001', 'u-official-001', 10, 7, 70.0, '2026-08-20 10:30:00');

INSERT OR REPLACE INTO competency_results (id, attempt_id, competency_id, score, status, priority, evidence) VALUES
('cr-001', 'att-001', 'comp-stat-001', 42.0, 'critical_gap', 1, 'Missed 3 out of 4 questions on sampling errors, design effects, and hypothesis testing.'),
('cr-002', 'att-001', 'comp-stat-002', 55.0, 'critical_gap', 2, 'Struggled with complex survey sampling weights and variance estimation.'),
('cr-003', 'att-001', 'comp-stat-003', 65.0, 'needs_improvement', 3, 'Correctly identified CPI formula but missed base year adjustment concepts.'),
('cr-004', 'att-001', 'comp-tech-001', 88.0, 'strong', 0, 'Demonstrated high proficiency in Python data structures and SQL window functions.'),
('cr-005', 'att-001', 'comp-tech-002', 75.0, 'needs_improvement', 4, 'Good grasp of GIS visualization, basic understanding of SDMX eXchange standards.'),
('cr-006', 'att-001', 'comp-gov-001', 90.0, 'strong', 0, 'Excellent compliance knowledge regarding DPDP Act and Data Privacy rules.'),
('cr-007', 'att-001', 'comp-mgr-001', 85.0, 'strong', 0, 'Solid understanding of Critical Path Method and survey team leadership.');

-- Seed Learning Paths
INSERT OR REPLACE INTO learning_paths (id, user_id, attempt_id, course_id, course_title, competency_id, provider, priority, estimated_duration, status) VALUES
('lp-001', 'u-official-001', 'att-001', 'NSSTA-TPAC-STAT-101', 'Advanced Survey Sampling & Weight Calibration', 'comp-stat-002', 'NSSTA TPAC', 'High', '4 hours', 'IN_PROGRESS'),
('lp-002', 'u-official-001', 'att-001', 'IGOT-STAT-204', 'Statistical Inference & Hypothesis Testing in Practice', 'comp-stat-001', 'iGOT Karmayogi', 'High', '3 hours', 'ASSIGNED'),
('lp-003', 'u-official-001', 'att-001', 'IGOT-ECON-102', 'National Accounts Statistics & Inflation Metrics', 'comp-stat-003', 'iGOT Karmayogi', 'Medium', '2.5 hours', 'ASSIGNED'),
('lp-004', 'u-official-001', 'att-001', 'NSSTA-TECH-301', 'SDMX Metadata Standards & Open Data Publishing', 'comp-tech-002', 'NSSTA TPAC', 'Medium', '2 hours', 'ASSIGNED');
