require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const app = require('./server');
const port = process.env.PORT;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}
