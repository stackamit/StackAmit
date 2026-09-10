# StackAmit — Internship Management System

> **A full-stack platform for managing internships, students, trainers, tasks, communication, notifications, and verifiable certificates.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-stackamit.netlify.app-0ea5e9?style=for-the-badge)](https://stackamit.netlify.app/)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Real Time](https://img.shields.io/badge/Real--Time-Socket.io-010101?style=flat-square&logo=socket.io&logoColor=white)](https://socket.io/)
[![Styling](https://img.shields.io/badge/Styling-Tailwind%20CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

**Live application:** https://stackamit.netlify.app/

---

## 📌 Overview

**StackAmit** is a production-oriented full-stack **Internship Management System** designed to manage the complete internship lifecycle in one platform.

Instead of treating internships as a collection of spreadsheets, emails, chat applications, and manually generated certificates, StackAmit brings the major workflows into a unified application:

- Internship discovery and publishing
- Student registration and email verification
- Internship applications and approval workflows
- Trainer onboarding and student assignment
- Task creation, submission, review, and grading
- Real-time trainer–student communication
- Notifications and activity tracking
- Certificate generation and public verification
- QR-based certificate verification
- Student profile and resume management
- Admin dashboards and analytics
- Feedback and discussion management
- Excel reporting and data export
- Dynamic website and system settings

The application has three primary authenticated roles:

**Admin → Trainer → Student**

It also provides a public experience for visitors, students, institutions, and employers who need to browse internships or verify certificates without logging in.

---

## 🌐 Live Demo

### StackAmit Web Application

**https://stackamit.netlify.app/**

The deployed frontend provides the public website, authentication screens, internship browsing, certificate verification, and role-specific dashboards.

> **Deployment note:** The repository contains environment-variable templates/configuration used for development. Production API URLs and secrets should be configured through the deployment platform rather than committed to the repository.

---

# 🎯 Problem Statement

Internship programs often depend on disconnected tools:

- Students apply through forms or messages.
- Trainers track tasks manually.
- Administrators maintain student and trainer records separately.
- Task submissions are scattered across email, drives, and chat.
- Progress tracking is difficult.
- Certificate creation is often manual.
- Employers have no convenient way to validate certificates.
- Important communication and notifications can be missed.

StackAmit addresses this by providing a centralized platform where the internship lifecycle can be managed from **application → assignment → training → task submission → review → completion → certification → verification**.

---

# 💡 Solution

StackAmit provides an end-to-end workflow for internship management.

```text
Public Website
      │
      ▼
Student Registration
      │
      ▼
Email OTP Verification
      │
      ▼
Browse Internships
      │
      ▼
Apply for Internship
      │
      ▼
Admin Review / Approval
      │
      ▼
Trainer Assignment
      │
      ▼
Tasks & Project Work
      │
      ▼
Student Submission
      │
      ▼
Trainer Review & Evaluation
      │
      ▼
Internship Completion
      │
      ▼
Certificate Generation
      │
      ▼
QR / Certificate Number Verification
```

This workflow makes StackAmit suitable for internship providers, training organizations, educational institutions, bootcamps, and similar learning programs.

---

# 👥 User Roles

## 1. Admin

The Admin has system-wide control.

### Main capabilities

- Admin dashboard and analytics
- Manage students
- Create and manage trainers
- Create and manage internships
- Publish, close, archive, and delete internships
- Review student applications
- Approve or reject applications
- Assign students to trainers
- Manage certificates
- Monitor discussions
- Manage feedback
- Configure system settings
- Manage website content
- Manage notification settings
- View recent activity
- Export system data to Excel
- Receive system-wide notifications

### Admin dashboard includes

- Total students
- Total trainers
- Active internships
- Certificates issued
- Tasks completed
- Pending applications
- Task completion analytics
- Recent activity
- Quick actions

---

## 2. Trainer

The Trainer role focuses on mentorship and student progress.

### Main capabilities

- Trainer dashboard
- View assigned students
- Monitor student progress
- Create tasks
- Set task priorities and deadlines
- Attach task resources
- Review student submissions
- Approve submissions
- Reject submissions
- Request resubmission
- Award marks
- Add reviewer remarks
- Communicate with students in real time
- View task statistics
- Issue internship certificates
- Manage trainer profile
- Receive notifications

Trainer visibility is intentionally scoped so trainers primarily work with their assigned students and internship activities.

---

## 3. Student

The Student role provides the complete learner-side internship workflow.

### Main capabilities

- Register with email verification
- Login securely
- Browse available internships
- Filter internships by category
- View internship details
- Apply for internships
- Track application status
- Withdraw applications
- View assigned trainer
- View current internship
- View assigned tasks
- Submit project/task work
- Upload files
- Submit GitHub repository links
- Submit live deployment URLs
- Submit documentation
- Submit video demonstration links
- Track task review status
- Communicate with trainers
- Receive notifications
- Manage profile
- Upload resume
- Upload avatar
- Manage skills and social links
- View earned certificates
- Download/share certificates

---

## 4. Public Visitor

Unauthenticated visitors can:

- View the StackAmit homepage
- Browse public internships
- Filter internship categories
- Learn about the platform
- Contact the organization
- Submit feedback
- View terms and conditions
- Verify certificates
- Scan certificate QR codes
- Open a public certificate verification page

This public certificate-verification workflow is particularly useful for employers, institutions, and third parties.

---

# ✨ Core Features

## 🔐 Authentication & Authorization

StackAmit implements role-based authentication using JWT.

### Authentication workflow

- Student registration
- Email OTP verification
- Login
- Access token
- Refresh token
- Logout
- Forgot password
- Password reset through OTP
- Change password
- Forced password change for temporary accounts
- Role-based route protection

The frontend uses an Axios interceptor to attach access tokens and attempt token refresh when an authenticated request receives a `401` response.

---

# 🏢 Internship Management

Admins can create structured internship programs containing information such as:

- Internship title
- Description
- Category
- Duration
- Weekly hours
- Eligibility
- Requirements
- Required skills
- Responsibilities
- Learning outcomes
- Certificate type
- Total seats
- Application deadline
- Start date
- End date
- Publication status

### Internship lifecycle

```text
Draft / Setup
     │
     ▼
Published
     │
     ├── Student Applications
     │
     ▼
Closed
     │
     ▼
Archived
```

The backend also maintains filled-seat information and prevents duplicate applications through the application data model.

---

# 📝 Application Management

Students can apply for published internships.

Applications support statuses such as:

- Pending
- Approved
- Rejected
- Withdrawn

Admins/trainers can review applications and add review notes.

The database uses a compound uniqueness constraint for the student/internship relationship to help enforce the one-application-per-internship rule.

---

# 📚 Task & Submission Management

Trainers can create structured tasks for assigned students.

### Task configuration

- Title
- Description
- Priority
- Due date
- Attachments
- Instructions
- Total marks
- Internship association
- Student assignment

### Student submission options

A student can submit:

- Files
- GitHub repository URL
- Live deployment URL
- Documentation
- Video demonstration URL
- Remarks

### Review workflow

```text
Task Assigned
     │
     ▼
Student Works
     │
     ▼
Submission
     │
     ▼
Trainer Review
   ┌─┴───────────────┐
   ▼                 ▼
Approved       Resubmission Requested
   │                 │
   ▼                 └──────► Student Resubmits
Completed
```

Submission states include:

- Submitted
- Approved
- Rejected
- Resubmission requested

Trainers can also provide marks and reviewer remarks.

---

# 💬 Real-Time Discussion & Messaging

StackAmit includes real-time communication powered by **Socket.io**.

The discussion system is designed around internship-specific conversations between trainers and students.

### Supported capabilities

- Private conversations
- Group/announcement-style conversations
- Text messages
- Attachments
- Message replies
- Message editing
- Message deletion
- Pinning important messages
- Important-message marking
- Typing indicators
- Online/offline status
- Read tracking
- Unread message counts
- Conversation notifications
- Admin discussion monitoring

### Real-time event architecture

```text
React Client
     │
     │ Socket.io Client
     ▼
Socket.io Server
     │
     ├── Authentication
     ├── Conversation Rooms
     ├── Message Events
     ├── Typing Events
     ├── Presence Events
     └── Notification Events
     │
     ▼
MongoDB
```

This avoids relying only on page refreshes for communication and enables a more application-like messaging experience.

---

# 🔔 Notification System

Notifications keep users informed about important internship events.

Examples include:

- Task assigned
- Task reminder
- Task completed
- Submission reviewed
- Application approved
- Application rejected
- Certificate issued
- Internship created/updated/closed
- Trainer updates
- Welcome notifications
- General system notifications

Notifications support read/unread state tracking and real-time delivery through Socket.io.

---

# 🏆 Certificate Management

One of the key features of StackAmit is its digital certificate workflow.

The platform supports certificate types such as:

- Completion
- Participation
- Merit

Each certificate can contain:

- Student name
- Internship title
- Duration
- Issue date
- Issuer
- Unique certificate number
- Verification identifier
- QR verification data
- PDF certificate

### Certificate workflow

```text
Internship Completed
        │
        ▼
Trainer/Admin Issues Certificate
        │
        ├──────────────► PDF Certificate
        │
        └──────────────► QR Verification
                              │
                              ▼
                       Public Verification
```

---

# 🔎 Public Certificate Verification

Certificates can be verified without requiring a user account.

Verification is supported through:

### Certificate number

A user can enter the certificate number to retrieve its verification information.

### QR code

The platform provides QR-based certificate verification and includes a browser-based certificate scanner.

### Direct verification URL

Certificates can also be opened through a shareable public verification page.

This creates a simple verification flow for:

- Employers
- Recruiters
- Educational institutions
- Training organizations
- Students
- Third-party reviewers

Certificates can also be revoked by authorized administrators, with revocation information retained by the system.

---

# 👤 Student Profile Management

Students can maintain a professional internship profile.

### Profile information

- Name
- Gender
- Date of birth
- Phone
- Address
- College/university
- Course
- Branch
- Academic year
- Skills
- LinkedIn
- GitHub
- Resume
- Avatar
- Current internship
- Assigned trainer

The application also provides a profile completion indicator to encourage students to maintain complete professional information.

---

# 👨‍🏫 Trainer Management

Admins can create and manage trainer accounts.

Trainer records can include:

- Name
- Email
- Bio
- Expertise areas
- Maximum student capacity
- Assigned students
- Rating/performance information
- Internship/task statistics
- Active/inactive status

The system supports assignment tracking and trainer/student relationships.

---

# 📊 Dashboards & Analytics

Different dashboards are provided for different roles.

## Admin Dashboard

Provides a system-wide overview:

- Students
- Trainers
- Internships
- Applications
- Certificates
- Tasks
- Application breakdown
- Task completion statistics
- Recent activity
- Quick actions

## Trainer Dashboard

Focuses on mentorship:

- Assigned students
- Pending tasks
- Completed tasks
- Completion rate
- Task overview
- Student activity

## Student Dashboard

Focuses on the learner's internship journey:

- Current internship
- Application progress
- Assigned tasks
- Certificates
- Profile completion
- Completion statistics

Charts are implemented using **Recharts** where analytical visualizations are required.

---

# ⚙️ Dynamic System Settings

StackAmit includes an administrative settings system rather than hard-coding all public website content.

Settings can cover:

- Organization/company information
- Logo
- Tagline
- Description
- Contact information
- Social links
- Email configuration
- Certificate configuration
- Website hero content
- Homepage statistics
- Why Choose Us content
- CTA content
- About page content
- Security-related configuration

Settings are categorized into public and confidential information, allowing the application to expose only appropriate settings to unauthenticated users.

---

# 📨 Feedback Management

The platform provides a feedback system for collecting user input.

Supported feedback categories include:

- General Feedback
- Testimonial
- Feature Request
- Bug Report
- Complaint

Admins can review feedback, track status, reply, and manage feedback records.

---

# 📁 File Uploads & Cloud Storage

StackAmit uses:

- **Multer** for handling incoming uploads
- **Cloudinary** for cloud-based file storage

Upload workflows are used for resources such as:

- Student avatars
- Resumes
- Documents
- Images
- Certificate assets
- Other supported attachments

The backend applies file-type and upload-size restrictions before processing files.

---

# 📈 Reports & Data Export

The backend provides role-specific dashboard reporting endpoints and administrative export functionality.

Admin reporting includes support for exporting system data to **Excel** using ExcelJS.

This is useful for operational tasks such as:

- Student records
- Internship records
- Trainer records
- Applications
- System reporting

---

# 🧾 Activity Logging & Audit Trail

StackAmit includes activity logging for important system actions.

Audit information can include:

- User
- Action
- Entity type
- Entity ID
- Metadata/details
- IP address
- User agent

This helps provide visibility into administrative and system activity.

---

# 🛡️ Security

Security has been considered at both frontend and backend levels.

### Backend security mechanisms

- JWT authentication
- Access and refresh tokens
- HTTP-only cookies for refresh-token handling
- Password hashing with bcryptjs
- Role-based authorization
- Helmet security headers
- CORS configuration
- API rate limiting
- Authentication-specific rate limiting
- Request validation
- Cookie parsing
- Controlled file uploads
- MongoDB/Mongoose data layer
- Activity logging

### Authentication model

```text
Login
  │
  ├── Access Token
  │       └── Short-lived API authorization
  │
  └── Refresh Token
          └── Longer-lived session renewal
```

The frontend also attempts automatic access-token renewal through the refresh-token endpoint when an authenticated API request expires.

---

# 🧱 Technical Architecture

```text
                         ┌───────────────────────┐
                         │     Public Users      │
                         │ Students / Employers  │
                         └───────────┬───────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────┐
│                 React + Vite Frontend                    │
│                                                          │
│ React Router │ Tailwind │ Redux Toolkit │ Context API    │
│ Axios        │ React Query │ Recharts │ Framer Motion    │
│ Socket.io Client │ React Hook Form │ QR Scanner         │
└─────────────────────────┬────────────────────────────────┘
                          │ HTTPS / REST
                          │ WebSocket
                          ▼
┌──────────────────────────────────────────────────────────┐
│                 Node.js + Express API                    │
│                                                          │
│ Auth │ Internships │ Applications │ Tasks │ Students     │
│ Trainers │ Certificates │ Discussions │ Notifications    │
│ Reports │ Settings │ Uploads │ Feedback                  │
└───────────────┬──────────────────────┬───────────────────┘
                │                      │
                ▼                      ▼
       ┌────────────────┐      ┌──────────────────┐
       │ MongoDB Atlas  │      │    Socket.io     │
       │                │      │ Real-time events │
       │ Application    │      └──────────────────┘
       │ Data & Users   │
       └────────────────┘
                │
       ┌────────┴───────────────┐
       ▼                        ▼
┌───────────────┐       ┌────────────────┐
│  Cloudinary   │       │    SendGrid    │
│ File Storage  │       │ Email Delivery │
└───────────────┘       └────────────────┘
                │
                ▼
        ┌──────────────┐
        │ PDF / QR     │
        │ Certificates │
        └──────────────┘
```

---

# 🧰 Technology Stack

## Frontend

| Technology | Purpose |
|---|---|
| React 18 | UI development |
| Vite 6 | Development/build tooling |
| React Router DOM | Client-side routing |
| Tailwind CSS | Styling |
| Redux Toolkit | UI state management |
| React Context | Authentication and socket state |
| Axios | REST API communication |
| TanStack React Query | Data fetching/cache support |
| Framer Motion | UI animations |
| React Hook Form | Form handling |
| Recharts | Analytics and charts |
| React Icons | Icons |
| Socket.io Client | Real-time communication |
| html5-qrcode | QR certificate scanning |
| qrcode.react | QR rendering |
| react-hot-toast | User feedback/toasts |
| emoji-picker-react | Messaging emoji support |

## Backend

| Technology | Purpose |
|---|---|
| Node.js | Server runtime |
| Express.js | REST API |
| MongoDB Atlas | Database |
| Mongoose | ODM/data modeling |
| JWT | Authentication |
| bcryptjs | Password hashing |
| Socket.io | Real-time communication |
| Multer | File upload processing |
| Cloudinary | Cloud file storage |
| SendGrid | Email delivery |
| PDFKit | PDF certificate generation |
| QRCode | QR generation |
| ExcelJS | Excel export |
| Helmet | HTTP security |
| CORS | Cross-origin configuration |
| express-rate-limit | Rate limiting |
| express-validator | Request validation |
| cookie-parser | Cookie handling |
| Morgan | HTTP logging |
| UUID | Unique identifiers |

---

# 🗂️ Project Structure

```text
StackAmit/
│
├── client/
│   ├── public/
│   │   └── stackamit-logo.jpg
│   │
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatPanel.jsx
│   │   │   └── NotificationPanel.jsx
│   │   │
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── SocketContext.jsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useNotifications.js
│   │   │   └── useSiteSettings.js
│   │   │
│   │   ├── layouts/
│   │   │   ├── AdminLayout.jsx
│   │   │   ├── AuthLayout.jsx
│   │   │   ├── DashboardLayout.jsx
│   │   │   ├── PublicLayout.jsx
│   │   │   ├── StudentLayout.jsx
│   │   │   └── TrainerLayout.jsx
│   │   │
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── public/
│   │   │   ├── shared/
│   │   │   ├── student/
│   │   │   └── trainer/
│   │   │
│   │   ├── redux/
│   │   │   ├── slices/
│   │   │   └── store.js
│   │   │
│   │   ├── services/
│   │   │   └── api.js
│   │   │
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   │
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── index.html
│
├── server/
│   ├── config/
│   │   ├── db.js
│   │   └── seedAdmin.js
│   │
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── socket/
│   ├── validators/
│   ├── server.js
│   └── package.json
│
├── Logo.jpg
├── projectPRD.txt
└── .gitignore
```

---

# 🗃️ Database Model Overview

The backend uses MongoDB with Mongoose.

Major models include:

```text
User
 ├── Admin
 ├── Student
 └── Trainer

Internship
Application
Assignment
Task
Submission
Certificate
Conversation
Message
Notification
Feedback
OTP
ActivityLog
Setting
```

### Important relationships

```text
Student
   │
   ├── Applications ─────► Internship
   │
   ├── Assignment ───────► Trainer
   │
   ├── Tasks ─────────────► Internship
   │
   ├── Submissions ───────► Tasks
   │
   └── Certificates ──────► Internship
```

This relational design is implemented using MongoDB document references and Mongoose population where required.

---

# 🔌 API Overview

The backend exposes REST APIs under:

```text
/api
```

### Main route groups

| Route | Purpose |
|---|---|
| `/api/auth` | Authentication and account workflows |
| `/api/students` | Student management |
| `/api/trainers` | Trainer management |
| `/api/internships` | Internship management |
| `/api/applications` | Internship applications |
| `/api/tasks` | Tasks and submissions |
| `/api/notifications` | Notifications |
| `/api/certificates` | Certificate generation and verification |
| `/api/settings` | Dynamic system settings |
| `/api/reports` | Dashboard reports and exports |
| `/api/upload` | File uploads |
| `/api/discussions` | Conversations and messaging |
| `/api/feedback` | Feedback management |

### Health endpoint

```http
GET /api/health
```

The health endpoint is used to confirm that the backend API is running.

---

# 🔄 Frontend Routing

The React application separates routes by responsibility.

### Public

```text
/
 /about
 /contact
 /internships
 /verify-certificate
 /certificate/:id
 /scan-certificate
 /terms-and-conditions
 /feedback
```

### Authentication

```text
/login
/register
/verify-email
/forgot-password
/change-password
```

### Admin

```text
/admin/overview
/admin/students
/admin/trainers
/admin/internships
/admin/certificates
/admin/assignments
/admin/applications
/admin/discussions
/admin/feedback
/admin/profile
/admin/notifications
/admin/settings
```

### Trainer

```text
/trainer/overview
/trainer/students
/trainer/tasks
/trainer/discussions
/trainer/certificates
/trainer/feedback
/trainer/notifications
```

### Student

```text
/student/overview
/student/profile
/student/internships
/student/tasks
/student/applications
/student/discussions
/student/certificates
/student/feedback
/student/notifications
```

Protected routes are guarded according to authentication state and user role.

---

# 🚀 Local Development Setup

## Prerequisites

Install:

- Node.js
- npm
- MongoDB Atlas account
- Cloudinary account
- SendGrid account (if email functionality is required)
- Git

---

## 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd StackAmit
```

---

## 2. Install frontend dependencies

```bash
cd client
npm install
```

---

## 3. Configure frontend environment

Create:

```text
client/.env
```

Example:

```env
VITE_API_URL=http://localhost:5000
VITE_APP_NAME=StackAmit
```

For production, set `VITE_API_URL` to the deployed backend URL.

---

## 4. Install backend dependencies

```bash
cd ../server
npm install
```

---

## 5. Configure backend environment

Create:

```text
server/.env
```

Use your own values for all credentials and secrets.

Example structure:

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret
JWT_EXPIRE=15m

JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRE=7d

ADMIN_NAME=your_admin_name
ADMIN_EMAIL=your_admin_email
ADMIN_PASSWORD=your_admin_password

SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM=your_verified_sender_email

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

CLIENT_URL=http://localhost:5173

CERTIFICATE_SECRET=your_certificate_secret
COOKIE_SECRET=your_cookie_secret

BCRYPT_SALT=12
```

> **Never commit `.env` files, API keys, database credentials, JWT secrets, email credentials, or Cloudinary secrets to GitHub.**

---

# ▶️ Run the Backend

From the `server` directory:

```bash
npm run dev
```

The backend normally runs on:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```

---

# ▶️ Run the Frontend

From the `client` directory:

```bash
npm run dev
```

The Vite development server normally runs on:

```text
http://localhost:5173
```

---

# 🏗️ Production Build

Build the frontend:

```bash
cd client
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Build output:

```text
client/dist/
```

The frontend can be deployed to services such as Netlify.

The backend requires a Node.js-compatible hosting environment because it runs Express and Socket.io.

---

# 🌍 Deployment Architecture

A typical production deployment can be structured as:

```text
                 Internet
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
   Netlify Frontend      Node.js Backend
   React + Vite          Express + Socket.io
          │                   │
          └─────────┬─────────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
     MongoDB Atlas        Cloudinary
                            │
                            ▼
                         SendGrid
```

### Current public frontend

```text
https://stackamit.netlify.app/
```

For production deployment, configure:

- Frontend API URL
- Backend client/origin URL
- MongoDB connection
- JWT secrets
- Cookie settings
- Cloudinary credentials
- SendGrid credentials
- Certificate secret

---

# 🔐 Environment Variables

The application uses environment variables for deployment-specific configuration.

### Frontend

```text
VITE_API_URL
VITE_APP_NAME
```

### Backend

```text
PORT
NODE_ENV
MONGODB_URI

JWT_SECRET
JWT_EXPIRE
JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRE

ADMIN_NAME
ADMIN_EMAIL
ADMIN_PASSWORD

SENDGRID_API_KEY
EMAIL_FROM

CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET

CLIENT_URL

CERTIFICATE_SECRET
COOKIE_SECRET
BCRYPT_SALT
```

Secrets should be stored using the environment-variable system of the hosting provider.

---

# 🧪 Recommended Testing Checklist

Before production deployment, test the following workflows.

## Authentication

- [ ] Student registration
- [ ] OTP verification
- [ ] Login
- [ ] Logout
- [ ] Access-token expiry
- [ ] Refresh-token flow
- [ ] Forgot password
- [ ] Reset password
- [ ] Change password
- [ ] Role-based access

## Internship

- [ ] Create internship
- [ ] Publish internship
- [ ] Browse internships publicly
- [ ] Filter internships
- [ ] Apply for internship
- [ ] Approve/reject application
- [ ] Withdraw application
- [ ] Close internship

## Trainer

- [ ] Create trainer
- [ ] Trainer login
- [ ] Assign student
- [ ] Update trainer
- [ ] Suspend/activate trainer

## Tasks

- [ ] Create task
- [ ] Assign task
- [ ] Submit task
- [ ] Upload submission
- [ ] Review submission
- [ ] Approve
- [ ] Reject
- [ ] Request resubmission
- [ ] Award marks

## Communication

- [ ] Create/open conversation
- [ ] Send message
- [ ] Receive real-time message
- [ ] Typing indicator
- [ ] Online status
- [ ] Edit message
- [ ] Delete message
- [ ] Pin message
- [ ] Read status

## Certificates

- [ ] Generate certificate
- [ ] Generate PDF
- [ ] Generate QR
- [ ] Verify by certificate number
- [ ] Scan QR
- [ ] Open public certificate URL
- [ ] Revoke certificate
- [ ] Verify revoked certificate behavior

## Notifications

- [ ] Task notification
- [ ] Application notification
- [ ] Certificate notification
- [ ] Read notification
- [ ] Mark all as read
- [ ] Real-time notification

---

# 📱 Responsive & UX Considerations

The frontend is designed with Tailwind CSS and role-specific layouts.

The interface includes:

- Responsive dashboard layouts
- Public website pages
- Authentication layouts
- Dashboard navigation
- Dark-mode-aware styling
- Toast notifications
- Loading states
- Empty states
- Error handling
- Modal-based workflows
- Interactive charts
- Real-time messaging UI
- QR scanning interface

---

# 📊 Feature Matrix

| Feature | Public | Student | Trainer | Admin |
|---|:---:|:---:|:---:|:---:|
| View Website | ✅ | ✅ | ✅ | ✅ |
| Browse Internships | ✅ | ✅ | ✅ | ✅ |
| Apply for Internship | ❌ | ✅ | ❌ | ❌ |
| Manage Applications | ❌ | Own | Assigned Scope | All |
| Manage Students | ❌ | Own Profile | Assigned Students | All |
| Manage Trainers | ❌ | ❌ | ❌ | ✅ |
| Create Internships | ❌ | ❌ | ❌ | ✅ |
| Create Tasks | ❌ | ❌ | ✅ | — |
| Submit Tasks | ❌ | ✅ | ❌ | ❌ |
| Review Tasks | ❌ | ❌ | ✅ | — |
| Real-Time Chat | ❌ | ✅ | ✅ | Monitor |
| Generate Certificates | ❌ | ❌ | ✅ | ✅ |
| Verify Certificates | ✅ | ✅ | ✅ | ✅ |
| Manage Settings | ❌ | ❌ | ❌ | ✅ |
| Feedback | ✅ | ✅ | ✅ | Manage |
| Notifications | ❌ | ✅ | ✅ | ✅ |
| Excel Export | ❌ | ❌ | ❌ | ✅ |

---

# 🎨 UI & Design Direction

StackAmit follows a modern SaaS-style interface built around:

- Clean dashboard layouts
- Card-based information architecture
- Consistent typography
- Responsive navigation
- Status badges
- Data tables
- Charts and statistics
- Modal forms
- Toast-based feedback
- Dark-mode-compatible components
- Professional internship/certificate presentation

The public site emphasizes:

- Learning
- Career development
- Mentorship
- Real projects
- Certification
- Secure verification
- Community

---

# 🧠 Design Philosophy

StackAmit is designed around a simple principle:

> **One platform for the complete internship journey.**

Instead of making students switch between multiple tools, the system connects:

```text
Learning
   ↓
Internship
   ↓
Mentorship
   ↓
Tasks
   ↓
Projects
   ↓
Evaluation
   ↓
Certification
   ↓
Verification
```

---

# 📌 Current Project Scope

Based on the current implementation, StackAmit is primarily an **internship and learning-management platform** with strong workflow automation, real-time communication, and digital certification capabilities.

The project branding/PRD describes the platform as an **AI-powered learning management** product, while the current implementation reviewed in this repository is centered on internship management, communication, certification, notifications, analytics, and administration.

This distinction is useful when presenting the project publicly: avoid claiming AI functionality unless a specific AI module is actually implemented and deployed.

---

# 🚧 Potential Future Improvements

Possible next-stage improvements include:

- AI-based student–internship recommendations
- AI resume analysis
- AI-powered task feedback
- Automated progress insights
- Advanced mentor performance analytics
- Attendance and session management
- Video learning modules
- Calendar/scheduling integration
- Automated certificate templates
- Advanced audit dashboards
- Two-factor authentication
- More granular permission policies
- Automated email delivery monitoring
- Background job/queue processing
- Automated integration tests
- End-to-end testing with Playwright/Cypress
- Docker-based deployment
- CI/CD pipelines
- API documentation with OpenAPI/Swagger
- Performance monitoring
- Error tracking and observability

---

# 🔭 Roadmap

### Phase 1 — Core Platform
- [x] Authentication
- [x] Role-based dashboards
- [x] Internship management
- [x] Application workflow
- [x] Student management
- [x] Trainer management

### Phase 2 — Learning Workflow
- [x] Task management
- [x] Task submissions
- [x] Review workflow
- [x] Progress tracking
- [x] Notifications

### Phase 3 — Communication
- [x] Real-time messaging
- [x] Typing indicators
- [x] Online/offline presence
- [x] Message management
- [x] Discussion monitoring

### Phase 4 — Certification
- [x] Certificate generation
- [x] PDF certificates
- [x] QR codes
- [x] Public verification
- [x] Certificate revocation

### Phase 5 — Platform Growth
- [ ] AI recommendations
- [ ] Advanced analytics
- [ ] Automated testing
- [ ] CI/CD
- [ ] API documentation
- [ ] Observability
- [ ] Advanced integrations

---

# 📸 Screenshots

Recommended screenshots for this repository:

```text
docs/
└── screenshots/
    ├── home.png
    ├── internships.png
    ├── login.png
    ├── student-dashboard.png
    ├── trainer-dashboard.png
    ├── admin-dashboard.png
    ├── task-management.png
    ├── discussion.png
    ├── certificate.png
    └── certificate-verification.png
```

These can be added later to create a stronger GitHub presentation.

---

# 📣 Social Media Showcase Plan

StackAmit has enough functionality to create a complete professional project showcase across LinkedIn, Instagram, X, YouTube, and portfolio pages.

Suggested content series:

### Post 01 — Project Introduction
**“I built StackAmit — a full-stack Internship Management System.”**

Show:
- Hero page
- Architecture
- Main dashboard

### Post 02 — Role-Based Platform
Show:
- Admin
- Trainer
- Student

Explain how each role gets a dedicated workflow.

### Post 03 — Internship Lifecycle
Show:

```text
Application → Approval → Assignment → Tasks → Review → Certificate
```

### Post 04 — Real-Time Communication
Show:
- Chat interface
- Online status
- Typing indicator
- Notifications

### Post 05 — Digital Certificates
Show:
- Certificate design
- QR code
- Verification page
- Certificate number

### Post 06 — Technical Architecture
Show:
- React
- Express
- MongoDB
- Socket.io
- Cloudinary
- SendGrid

### Post 07 — Security
Explain:
- JWT
- Refresh tokens
- HTTP-only cookies
- Role-based access
- Rate limiting
- Helmet
- Validation

### Post 08 — Developer Story
Share:
- Why the project was built
- Problems solved
- Major technical challenges
- Lessons learned

These visuals can be designed later as LinkedIn carousel slides, architecture diagrams, feature cards, launch posters, and portfolio graphics.

---

# 🤝 Contributing

Contributions, suggestions, and improvements are welcome.

A typical contribution workflow:

```bash
git checkout -b feature/your-feature
git add .
git commit -m "feat: add your feature"
git push origin feature/your-feature
```

Then open a Pull Request.

---

# 🔒 Security Notice

Do not expose:

- MongoDB connection strings
- JWT secrets
- Refresh-token secrets
- SendGrid API keys
- Cloudinary API secrets
- Admin passwords
- Cookie secrets
- Certificate secrets

Use `.env` files locally and environment variables in production.

If a secret has accidentally been committed to a public repository, rotate/revoke it immediately.

---

# 📄 License

The project currently uses the license configuration defined by its backend package metadata.

If this repository is intended to be publicly distributed or reused, add an explicit `LICENSE` file with the terms you want to apply.

---

# ⭐ Project Highlights

StackAmit demonstrates a broad range of full-stack development concepts:

- Modern React architecture
- REST API development
- MongoDB data modeling
- JWT authentication
- Role-based authorization
- Real-time WebSocket communication
- File upload and cloud storage
- Email automation
- PDF generation
- QR-code verification
- Dashboard analytics
- Excel reporting
- Dynamic system configuration
- Audit logging
- Responsive UI
- Production deployment concepts

It is more than a simple CRUD application: the project models a complete business workflow with multiple user roles, interconnected data, asynchronous notifications, real-time communication, and public verification.

---

# 🌐 Live Application

**StackAmit:**  
https://stackamit.netlify.app/

---

## Built with ❤️ for modern internship management
