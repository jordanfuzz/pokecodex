FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install --include=optional

COPY . .

ENTRYPOINT ["tail", "-f", "/dev/null"]