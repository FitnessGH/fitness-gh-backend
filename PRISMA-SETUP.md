# Prisma Database Setup

This project uses Prisma as the ORM for database management. Follow these steps to set up your database.

## Prerequisites

- PostgreSQL database running locally or remotely
- Node.js and pnpm installed

## Environment Setup

1. Create a `.env` file in the project root, if not already created (copy from `.env.sample`):

```bash
cp .env.sample .env
```

2. Update the `DATABASE_URL` in your `.env` file:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/fitness_gh_db?schema=public"
```

Replace `username`, `password`, `localhost:5432`, and `fitness_gh_db` with your actual database credentials.

## Database Commands

### Generate Prisma Client
```bash
pnpm db:generate
```

### Push schema to database (for development)
```bash
pnpm db:push
```

### Create and run migrations (for production)
```bash
pnpm db:migrate
```

### Open Prisma Studio (Database GUI)
```bash
pnpm db:studio
```

### Seed the database with sample data
```bash
pnpm db:seed
```

## Database Schema

The fitness app includes the following models:

- **User**: User profiles with fitness metrics

## API Endpoints

Once set up, the following endpoints are available:

### Users
- `GET /api/v1/users` - Get all users
- `GET /api/v1/users/:id` - Get user by ID
- `POST /api/v1/users` - Create new user
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user

### Health & Info
- `GET /health` - Database and service health check
- `GET /info` - Application information

## Development Workflow

1. Make changes to `prisma/schema.prisma`
2. Run `pnpm db:generate` to update the Prisma client
3. Run `pnpm db:push` to apply changes to the database
4. Optionally run `pnpm db:seed` to populate with sample data

## Production Deployment

1. Set up your production database
2. Update `DATABASE_URL` in production environment
3. Run `pnpm db:migrate:deploy` to apply migrations
4. Optionally run `pnpm db:seed` for initial data

## Troubleshooting

- **Connection issues**: Verify your `DATABASE_URL` is correct
- **Migration errors**: Check if your database schema is in sync
- **Type errors**: Run `pnpm db:generate` after schema changes