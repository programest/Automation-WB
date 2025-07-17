const express = require('express');
const { exec } = require('child_process');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('.'));

app.post('/run-script', (req, res) => {
  exec('node index.js', (error, stdout, stderr) => {
    if (error) {
      console.error('Script error:', stderr);
      return res.status(500).json({ error: 'Script execution failed' });
    }
    console.log('Script output:', stdout);
    res.status(200).json({ message: 'Script completed' });
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});