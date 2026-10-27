CREATE TYPE "PlatformRole" AS ENUM ('USER', 'OWNER');

ALTER TABLE "User"
ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER';
