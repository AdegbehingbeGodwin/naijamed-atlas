import axios from 'axios';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids');

  if (!idsParam) {
    return Response.json({ error: 'IDs parameter is required' }, { status: 400 });
  }

  try {
    const ids = idsParam.split(','); // Handle multiple IDs
    const idsStr = ids.join(',');
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${idsStr}&retmode=xml`;

    console.log('Making request to PubMed API:', url);

    const response = await axios.get(url, {
      headers: {
        'Accept': 'text/xml',
      },
    });

    console.log('Received response from PubMed API, length:', response.data.length);

    // Return the XML data
    return new Response(response.data, {
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error: any) {
    console.error('PubMed fetch error:', error.message);
    console.error('Error details:', error.response?.status, error.response?.data);
    return Response.json(
      { error: 'Failed to fetch PubMed data', details: error.message },
      { status: 500 }
    );
  }
}

export { GET as POST, GET as PUT, GET as DELETE }; // Allow multiple methods for flexibility