FROM alpine:3.9

WORKDIR /app

RUN apk --no-cache add nodejs npm

ADD . /app

RUN npm install

CMD ["node", "feed.js"]
