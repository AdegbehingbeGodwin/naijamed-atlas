const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all routes
app.use(cors());

// Proxy route for PubMed search
app.get('/api/pubmed/search', async (req, res) => {
  try {
    const { term } = req.query;
    console.log('Received search term:', term);

    const encodedTerm = encodeURIComponent(term);
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodedTerm}&retmode=json&retmax=30&sort=relevance`;

    console.log('Making request to PubMed API:', url);

    const response = await axios.get(url);

    console.log('PubMed search response status:', response.status);
    console.log('PubMed search response data keys:', Object.keys(response.data));
    if (response.data.esearchresult) {
      console.log('Found IDs count:', response.data.esearchresult.idlist?.length || 0);
    }

    res.json(response.data);
  } catch (error) {
    console.error('PubMed search error:', error.message);
    console.error('Error details:', error.response?.status, error.response?.data);
    res.status(500).json({ error: 'Failed to search PubMed', details: error.message });
  }
});

// Proxy route for PubMed fetch
app.get('/api/pubmed/fetch', async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ error: 'IDs parameter is required' });
    }

    const idsStr = Array.isArray(ids) ? ids.join(',') : ids;
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${idsStr}&retmode=xml`;

    console.log('Making request to PubMed API:', url);

    const response = await axios.get(url, {
      headers: {
        'Accept': 'text/xml',
      },
      responseType: 'text' // Get response as text to handle XML
    });

    console.log('Received response from PubMed API, length:', response.data.length);

    // Send the XML data directly
    res.set('Content-Type', 'text/xml');
    res.send(response.data);
  } catch (error) {
    console.error('PubMed fetch error:', error.message);
    console.error('Error details:', error.response?.status, error.response?.data);
    res.status(500).json({ error: 'Failed to fetch PubMed data', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`PubMed proxy server running on port ${PORT}`);
});