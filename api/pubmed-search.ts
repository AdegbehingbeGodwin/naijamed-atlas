import axios from 'axios';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const term = searchParams.get('term');

  if (!term) {
    return Response.json({ error: 'Term parameter is required' }, { status: 400 });
  }

  try {
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

    return Response.json(response.data);
  } catch (error: any) {
    console.error('PubMed search error:', error.message);
    console.error('Error details:', error.response?.status, error.response?.data);
    return Response.json(
      { error: 'Failed to search PubMed', details: error.message },
      { status: 500 }
    );
  }
}

export { GET as POST, GET as PUT, GET as DELETE }; // Allow multiple methods for flexibility