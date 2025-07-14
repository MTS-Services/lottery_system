# 🎲 Flutter Backend Express.js - Group Lottery System

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-5.x-blue.svg)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-blueviolet.svg)](https://prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15.x-blue.svg)](https://postgresql.org/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

A robust backend API system for managing group-based lottery contributions, built with Express.js and Prisma. This system allows users to create groups, manage contributions, and run automated lotteries for fund distribution.

## 📋 Table of Contents

- [✨ Features](#-features)
- [🛠️ Tech Stack](#️-tech-stack)
- [📁 Project Structure](#-project-structure)
- [🚀 Getting Started](#-getting-started)
- [⚙️ Configuration](#️-configuration)
- [📊 Database Schema](#-database-schema)
- [🔗 API Endpoints](#-api-endpoints)
- [🎯 Core Features](#-core-features)
- [📧 Email Integration](#-email-integration)
- [⏰ Scheduled Jobs](#-scheduled-jobs)
- [🔒 Security](#-security)
- [📖 Usage Examples](#-usage-examples)
- [🧪 Testing](#-testing)
- [🚀 Deployment](#-deployment)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## ✨ Features

### 🎪 **Group Management**
- **Create Groups**: Admins can create lottery groups with custom contribution amounts and frequencies
- **Group Activation**: Activate groups when minimum members are reached
- **Member Management**: Add/remove members, track membership status
- **Group Status Tracking**: PENDING → ACTIVE → COMPLETED lifecycle

### 💰 **Payment System**
- **Automated Payment Tracking**: Record and validate member contributions
- **Payment Cycles**: Weekly, Bi-weekly, or Monthly payment schedules
- **Payment Reminders**: Automated email notifications for overdue payments
- **Transaction Integrity**: Stripe integration with transaction ID tracking

### 🎲 **Lottery System**
- **Automated Lottery Execution**: Fair lottery system for fund distribution
- **Cycle Management**: Track payment cycles and lottery eligibility
- **Winner Selection**: Random selection from eligible members
- **Prize Distribution**: Automatic pot calculation and winner notification

### 👥 **User Management**
- **User Registration**: Secure user account creation
- **Role-Based Access**: Admin and Member roles with different permissions
- **Profile Management**: User profile updates and management

### 📧 **Invitation System**
- **Email Invitations**: Send group invitations via email
- **Invitation Codes**: Unique codes for secure group joining
- **Status Tracking**: Track invitation status (PENDING, ACCEPTED, EXPIRED)

### 🔔 **Notification System**
- **Email Notifications**: Payment reminders, lottery results, group updates
- **Scheduled Jobs**: Automated background tasks for system maintenance

## 🛠️ Tech Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **Node.js** | Runtime Environment | 18.x |
| **Express.js** | Web Framework | 5.1.0 |
| **Prisma** | Database ORM | 6.7.0 |
| **PostgreSQL** | Database | 15.x |
| **bcryptjs** | Password Hashing | 3.0.2 |
| **Nodemailer** | Email Service | 6.10.1 |
| **node-cron** | Task Scheduling | 3.0.3 |
| **Day.js** | Date Manipulation | 1.11.13 |
| **UUID** | Unique ID Generation | 11.1.0 |
| **CORS** | Cross-Origin Resource Sharing | 2.8.5 |

## 📁 Project Structure

```
flutter_backend_express.js/
├── 📁 prisma/
│   ├── 📄 schema.prisma              # Database schema definition
│   └── 📁 migrations/                # Database migration files
│       ├── 📄 migration_lock.toml
│       └── 📁 20250501031057_flutter_1/
│           └── 📄 migration.sql
├── 📁 src/
│   ├── 📄 app.js                     # Main application entry point
│   ├── 📁 controllers/               # Request handlers
│   │   ├── 📄 group.controller.js    # Group management
│   │   ├── 📄 invitation.controller.js # Invitation handling
│   │   ├── 📄 lottery.controller.js  # Lottery operations
│   │   ├── 📄 payment.controller.js  # Payment processing
│   │   └── 📄 user.controller.js     # User management
│   ├── 📁 services/                  # Business logic layer
│   │   ├── 📄 email.service.js       # Email operations
│   │   ├── 📄 group.service.js       # Group business logic
│   │   ├── 📄 invitation.service.js  # Invitation logic
│   │   ├── 📄 lottery.service.js     # Lottery algorithms
│   │   ├── 📄 payment.service.js     # Payment processing
│   │   └── 📄 user.service.js        # User operations
│   ├── 📁 routes/                    # API route definitions
│   │   ├── 📄 index.js               # Main router
│   │   ├── 📄 group.routes.js        # Group endpoints
│   │   ├── 📄 invitation.routes.js   # Invitation endpoints
│   │   ├── 📄 lottery.routes.js      # Lottery endpoints
│   │   ├── 📄 payment.routes.js      # Payment endpoints
│   │   └── 📄 user.routes.js         # User endpoints
│   ├── 📁 jobs/                      # Scheduled tasks
│   │   └── 📄 payment.reminder.job.js # Payment reminder cron job
│   └── 📁 utils/                     # Utility functions
│       ├── 📄 errors.js              # Error handling
│       ├── 📄 helpers.js             # Helper functions
│       └── 📄 prisma.client.js       # Prisma client setup
├── 📄 package.json                   # Project dependencies
└── 📄 README.md                      # Project documentation
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18.x or higher)
- **PostgreSQL** (v15.x or higher)
- **npm** or **yarn**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Shariarhosain/flutter_backend_express.js.git
   cd flutter_backend_express.js
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Run database migrations
   npx prisma migrate dev
   
   # (Optional) Seed the database
   npx prisma db seed
   ```

5. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

The server will start on `http://localhost:3000` (or your configured PORT).

## ⚙️ Configuration

Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/lottery_system?schema=public"

# Server Configuration
PORT=3000
NODE_ENV=development

# Email Configuration (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# Security
JWT_SECRET=your-super-secret-jwt-key
BCRYPT_ROUNDS=12

# Payment Integration (if using Stripe)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cron Job Configuration
PAYMENT_REMINDER_CRON=0 9 * * * # Daily at 9 AM
```

## 📊 Database Schema

### Core Models

#### 👤 User Model
```prisma
model User {
  userId       String    @id @unique
  name         String
  email        String    @unique
  dateOfBirth  DateTime  @db.Date
  passwordHash String
  role         Role      @default(MEMBER)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}
```

#### 👥 Group Model
```prisma
model Group {
  groupId            String      @id @default(uuid())
  groupName          String
  contributionAmount Float
  frequency          Frequency
  maxMembers         Int
  status             GroupStatus @default(PENDING)
  adminUserId        String
}
```

#### 🎫 Membership Model
```prisma
model Membership {
  membershipId       String   @id @default(uuid())
  joinDate          DateTime @default(now())
  hasWonLottery     Boolean  @default(false)
  cyclePaymentCount Int      @default(0)
  nextPaymentDueDate DateTime?
}
```

### Enums

- **Role**: `MEMBER`, `ADMIN`
- **Frequency**: `WEEKLY`, `BI_WEEKLY`, `MONTHLY`
- **GroupStatus**: `PENDING`, `ACTIVE`, `COMPLETED`, `CANCELLED`
- **PaymentStatus**: `PAID`, `UNPAID`
- **InvitationStatus**: `PENDING`, `ACCEPTED`, `EXPIRED`, `DECLINED`

## 🔗 API Endpoints

### 👤 User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/users/register` | Register a new user |
| `POST` | `/api/users/login` | User authentication |
| `GET` | `/api/users/profile/:userId` | Get user profile |
| `PUT` | `/api/users/profile/:userId` | Update user profile |

### 👥 Group Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/groups` | Create a new group |
| `POST` | `/api/groups/:groupId/activate` | Activate a group |
| `GET` | `/api/groups/:groupId` | Get group details |
| `GET` | `/api/groups/admin/:adminUserId` | Get admin's groups |
| `PUT` | `/api/groups/:groupId` | Update group settings |

### 📧 Invitations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/invitations/send` | Send group invitation |
| `POST` | `/api/invitations/accept` | Accept invitation |
| `GET` | `/api/invitations/:invitationCode` | Get invitation details |

### 💳 Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/payments/record` | Record a payment |
| `GET` | `/api/payments/group/:groupId` | Get group payments |
| `GET` | `/api/payments/user/:userId` | Get user payments |

### 🎲 Lottery

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/groups/:groupId/lottery/trigger` | Trigger lottery check |
| `GET` | `/api/groups/:groupId/lottery/history` | Get lottery history |

### 🔍 Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | System health status |

## 🎯 Core Features

### 1. Group Lifecycle Management

```javascript
// Create Group
const newGroup = await groupService.createGroup({
  adminUserId: "user-123",
  groupName: "Weekly Savings Circle",
  contributionAmount: 100.00,
  frequency: "WEEKLY",
  maxMembers: 10,
  description: "Weekly savings group for friends"
});

// Activate Group (when minimum members reached)
await groupService.activateGroup(groupId, adminUserId);
```

### 2. Automated Lottery System

The lottery system automatically:
- Checks if all active members have paid for the current cycle
- Selects a random winner from eligible members (who haven't won yet)
- Calculates the pot amount from all contributions
- Records the lottery result
- Sends notifications to winner and group members

### 3. Payment Tracking

```javascript
// Record Payment
const payment = await paymentService.recordPayment({
  membershipId: "membership-123",
  amount: 100.00,
  transactionId: "stripe_tx_456",
  paymentMethod: "card"
});
```

### 4. Email Notifications

The system sends automated emails for:
- Welcome messages for new members
- Payment reminders
- Lottery results
- Group status updates

## 📧 Email Integration

### Configuration

```javascript
// Email service setup with Nodemailer
const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

### Email Templates

- **Payment Reminder**: Sent to members with overdue payments
- **Lottery Winner**: Congratulations email to lottery winners
- **Group Invitation**: Invitation to join a group
- **Group Activation**: Notification when group becomes active

## ⏰ Scheduled Jobs

### Payment Reminder Job

```javascript
// Runs daily at 9 AM
cron.schedule('0 9 * * *', async () => {
  await sendPaymentReminders();
});
```

The job:
1. Identifies members with overdue payments
2. Sends personalized reminder emails
3. Logs reminder activities
4. Updates reminder timestamps

## 🔒 Security

### Security Measures

- **Password Hashing**: bcryptjs with salt rounds
- **Input Validation**: Request validation middleware
- **CORS Protection**: Configured for production environments
- **Error Handling**: Comprehensive error management
- **SQL Injection Prevention**: Prisma ORM protection

### Security Todos

- [ ] Implement JWT authentication
- [ ] Add rate limiting
- [ ] Implement API key authentication
- [ ] Add request logging
- [ ] Implement role-based access control

## 📖 Usage Examples

### Creating a Complete Group Flow

```javascript
// 1. Admin creates a group
POST /api/groups
{
  "adminUserId": "admin-123",
  "groupName": "Monthly Investment Club",
  "contributionAmount": 500.00,
  "frequency": "MONTHLY",
  "maxMembers": 12,
  "description": "Monthly investment and lottery group"
}

// 2. Send invitations to members
POST /api/invitations/send
{
  "groupId": "group-456",
  "invitedUserEmail": "member@example.com",
  "adminUserId": "admin-123"
}

// 3. Members accept invitations
POST /api/invitations/accept
{
  "invitationCode": "inv-code-789",
  "userId": "member-123"
}

// 4. Activate group when minimum members reached
POST /api/groups/group-456/activate
{
  "adminUserId": "admin-123"
}

// 5. Record payments
POST /api/payments/record
{
  "membershipId": "membership-123",
  "amount": 500.00,
  "transactionId": "stripe_tx_789"
}

// 6. Trigger lottery when cycle is complete
POST /api/groups/group-456/lottery/trigger
```

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm run test:unit
npm run test:integration
```

### Test Structure

```
tests/
├── unit/
│   ├── services/
│   ├── controllers/
│   └── utils/
├── integration/
│   ├── auth.test.js
│   ├── groups.test.js
│   └── payments.test.js
└── fixtures/
    └── test-data.js
```

## 🚀 Deployment

### Production Setup

1. **Environment Variables**
   ```bash
   NODE_ENV=production
   DATABASE_URL=postgresql://prod-connection-string
   PORT=8080
   ```

2. **Database Migration**
   ```bash
   npx prisma migrate deploy
   ```

3. **Process Management**
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start src/app.js --name "lottery-backend"
   pm2 startup
   pm2 save
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "start"]
```

### Heroku Deployment

```bash
# Add Heroku remote
heroku git:remote -a your-app-name

# Set environment variables
heroku config:set DATABASE_URL=your-postgres-url
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# Run migrations
heroku run npx prisma migrate deploy
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Contribution Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation
- Ensure all tests pass
- Follow conventional commit messages

### Development Setup

```bash
# Install development dependencies
npm install

# Run in development mode with hot reload
npm run dev

# Run linting
npm run lint

# Format code
npm run format
```

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Shariarhosain/flutter_backend_express.js/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Shariarhosain/flutter_backend_express.js/discussions)
- **Email**: support@yourdomain.com

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/) - Fast, unopinionated web framework
- [Prisma](https://prisma.io/) - Modern database toolkit
- [PostgreSQL](https://postgresql.org/) - Advanced open source database
- [Nodemailer](https://nodemailer.com/) - Email sending library

---

<div align="center">

**[⬆ Back to Top](#-flutter-backend-expressjs---group-lottery-system)**

Made with ❤️ by [Shariarhosain](https://github.com/Shariarhosain)

</div>
