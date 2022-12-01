FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install --quiet

COPY . .

ENTRYPOINT ["tail", "-f", "/dev/null"]