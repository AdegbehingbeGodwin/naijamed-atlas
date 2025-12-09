import React, { useState, useRef, useEffect } from 'react';
import { PubMedArticle, AppMode, ChatMessage } from './types';
import { searchPubMedIds, fetchArticleDetails } from './services/pubmedService';
import { generateRAGResponse } from './services/ragService';
import ArticleCard from './components/ArticleCard';
import LoadingState from './components/LoadingState';
import RichTextRenderer from './components/RichTextRenderer';

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.LANDING);
  const [query, setQuery] = useState('');
  const [articles, setArticles] = useState<PubMedArticle[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true); // State for sidebar visibility

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setMode(AppMode.SEARCHING);
    setIsLoading(true);
    setLoadingStep('Accessing PubMed Database...');
    setArticles([]);
    setChatHistory([]);

    try {
      // 1. Fetch IDs with Progress Callback
      const ids = await searchPubMedIds(query, (msg) => setLoadingStep(msg));

      if (ids.length === 0) {
        setLoadingStep('No relevant papers found in initial search.');
        setChatHistory([{
          id: 'error-no-ids',
          role: 'model',
          text: `I couldn't find specific research papers matching "${query}" even after checking National and Regional West African databases. \n\nTry using the scientific name if known, or broader terms like "Medicinal Plants Nigeria".`,
          timestamp: Date.now(),
          isError: true
        }]);
        setMode(AppMode.RESULTS);
        setIsLoading(false);
        return;
      }

      setLoadingStep(`Found ${ids.length} relevant papers. Retrieving abstracts...`);

      // 2. Fetch Details
      const fetchedArticles = await fetchArticleDetails(ids);

      // Check if articles were successfully retrieved
      if (fetchedArticles.length === 0) {
        setChatHistory([{
          id: 'error-no-articles',
          role: 'model',
          text: `Found ${ids.length} paper IDs but couldn't retrieve article details. This may be due to network restrictions or API limits.`,
          timestamp: Date.now(),
          isError: true
        }]);
        setMode(AppMode.RESULTS);
        setIsLoading(false);
        return;
      }

      setArticles(fetchedArticles);

      setLoadingStep('Synthesizing research...');

      // 3. RAG Generation
      const ragResponse = await generateRAGResponse(query, fetchedArticles);

      setChatHistory([
        { id: 'u-1', role: 'user', text: query, timestamp: Date.now() },
        { id: 'm-1', role: 'model', text: ragResponse, timestamp: Date.now() }
      ]);

      setMode(AppMode.RESULTS);

    } catch (error) {
      console.error("Error during search process:", error);
      setChatHistory([{
        id: 'error-gen',
        role: 'model',
        text: "An error occurred while processing your request. Please try again later.",
        timestamp: Date.now(),
        isError: true
      }]);
      setMode(AppMode.RESULTS);
    } finally {
      setIsLoading(false);
    }
  };

  const resetApp = () => {
    setMode(AppMode.LANDING);
    setQuery('');
    setArticles([]);
    setChatHistory([]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div
            onClick={resetApp}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <img
              src="/logo.png"
              alt="NaijaMed Atlas Logo"
              className="w-8 h-8 rounded-lg object-cover"
            />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              NaijaMed <span className="text-emerald-600">Atlas</span>
            </h1>
          </div>

          {mode === AppMode.RESULTS && (
            <div className="flex-1 max-w-md mx-8 hidden md:block">
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask a new question..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </form>
            </div>
          )}

          <div className="text-xs font-medium text-slate-500">
            Powered by Data Science Nigeria
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col">

        {/* LANDING VIEW */}
        {mode === AppMode.LANDING && (
          <div className="flex-grow flex flex-col items-center justify-center p-6 text-center animate-fade-in relative overflow-hidden bg-gradient-to-br from-slate-50 to-white">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-10 pointer-events-none">
              <div className="absolute top-10 left-10 w-64 h-64 bg-slate-400 rounded-full blur-3xl mix-blend-multiply filter"></div>
              <div className="absolute bottom-10 right-10 w-64 h-64 bg-slate-300 rounded-full blur-3xl mix-blend-multiply filter"></div>
            </div>

            <div className="max-w-2xl w-full space-y-8">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
                  Discover Nigerian <br />
                  <span className="text-emerald-600">Traditional Medicine</span>
                </h2>
                <p className="text-lg text-slate-600 max-w-xl mx-auto leading-relaxed">
                  Search millions of research articles instantly. Our AI synthesizes real research papers into clear, grounded answers about ethnobotany and herbal cures.
                </p>
              </div>

              <div className="bg-white p-2 rounded-2xl shadow-xl border border-slate-100 transform transition-transform hover:scale-[1.01]">
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>
                    <input
                      type="text"
                      className="block w-full pl-11 pr-4 py-4 text-slate-900 placeholder-slate-400 bg-transparent border-none focus:ring-0 text-lg"
                      placeholder="e.g. Malaria treatment, Bitter Leaf, Diabetes..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-emerald-600 text-white font-semibold py-4 px-8 rounded-xl hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 transition-colors shadow-lg"
                  >
                    Explore Atlas
                  </button>
                </form>
              </div>

              <div className="flex flex-wrap justify-center gap-3 text-sm text-slate-500">
                <span>Try searching:</span>
                <button onClick={() => { setQuery('malaria traditional treatment'); handleSearch(); }} className="hover:text-emerald-600 transition-colors bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 px-4 py-2 rounded-lg shadow-sm border border-slate-200">
                  Malaria
                </button>
                <button onClick={() => { setQuery('diabetes herbal remedies'); handleSearch(); }} className="hover:text-emerald-600 transition-colors bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 px-4 py-2 rounded-lg shadow-sm border border-slate-200">
                  Diabetes
                </button>
                <button onClick={() => { setQuery('stomach ulcer treatment'); handleSearch(); }} className="hover:text-emerald-600 transition-colors bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 px-4 py-2 rounded-lg shadow-sm border border-slate-200">
                  Stomach Ulcers
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LOADING VIEW */}
        {mode === AppMode.SEARCHING && (
          <div className="flex-grow flex flex-col items-center justify-center p-6">
            <LoadingState message={loadingStep} />
          </div>
        )}

        {/* RESULTS VIEW */}
        {mode === AppMode.RESULTS && (
          <div className="flex-grow flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden">

            {/* Left Panel: The Atlas (Source Articles) - Fixed width 30% with filtering */}
            <div className={`bg-gradient-to-b from-emerald-50 to-gray-50 border-r border-emerald-100 flex flex-col transition-all duration-300 ${isSidebarExpanded ? 'lg:w-[30%] w-full' : 'w-0 overflow-hidden'}`}>
              <div className="p-4 border-b border-emerald-100 bg-white sticky top-0 z-10">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-emerald-800 flex items-center gap-2">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                      Research Evidence
                    </h3>
                    <p className="text-sm text-emerald-600 mt-1">Source articles and studies</p>
                  </div>
                  <span className="text-xs font-mono text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full font-semibold">
                    {articles.length} Sources
                  </span>
                </div>

                {/* Search and Filter Controls */}
                <div className="space-y-3">
                  {/* Source Search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search sources..."
                      className="w-full pl-10 pr-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                    <svg className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap gap-2">
                    <select className="text-xs bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-emerald-500 text-emerald-700">
                      <option>All Types</option>
                      <option>Clinical Trial</option>
                      <option>Meta-analysis</option>
                      <option>Systematic Review</option>
                      <option>Observational</option>
                      <option>Case Study</option>
                    </select>
                    <select className="text-xs bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-emerald-500 text-emerald-700">
                      <option>All Regions</option>
                      <option>West Africa</option>
                      <option>Nigeria</option>
                      <option>Ghana</option>
                      <option>Cameroon</option>
                    </select>
                    <select className="text-xs bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-emerald-500 text-emerald-700">
                      <option>All Dates</option>
                      <option>Last 6 months</option>
                      <option>Last year</option>
                      <option>Last 2 years</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-white to-emerald-50">
                {articles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10 text-emerald-400">
                    <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <p className="text-lg font-medium">No articles found in context</p>
                    <p className="text-sm mt-1">The AI response was synthesized from research data</p>
                  </div>
                ) : (
                  articles.map((article, idx) => (
                    <div
                      key={article.pmid}
                      className="transform transition-transform hover:scale-[1.01] duration-200"
                    >
                      <ArticleCard
                        article={article}
                        index={idx}
                        showCompact={true}
                        onCardClick={() => {
                          // Highlight referenced sections in synthesis
                        }}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Main Panel: The Assistant (Chat) - Enhanced with better typography and structure */}
            <div className={`bg-gradient-to-b from-emerald-50 to-white flex flex-col h-full relative transition-all duration-300 ${isSidebarExpanded ? 'lg:w-[70%]' : 'w-full'}`}>
              <div className="p-4 border-b border-emerald-100 bg-white sticky top-0 z-10 flex justify-between items-center">
                <h3 className="font-bold text-emerald-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                  Medical Synthesis
                </h3>

                {/* Toggle button for sidebar */}
                <button
                  onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                  className="p-2 rounded-lg hover:bg-emerald-50 transition-colors flex items-center gap-1"
                  aria-label={isSidebarExpanded ? "Collapse Research Atlas" : "Expand Research Atlas"}
                >
                  <span className="hidden md:inline text-sm text-emerald-600">{isSidebarExpanded ? "Hide Sources" : "Show Sources"}</span>
                  {isSidebarExpanded ? (
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto">
                  {chatHistory.map((msg) => (
                    <div key={msg.id} className="mb-6">
                      {msg.role === 'model' && (
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
                            <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wider">Evidence Summary</span>
                            <span className="text-xs text-emerald-500">Grounded in {articles.length} Studies</span>
                          </div>

                          {/* Collapsible sections */}
                          <div className="bg-white rounded-xl shadow-sm border border-emerald-100 overflow-hidden mb-4">
                            <div className="p-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white">
                              <div className="flex justify-between items-center">
                                <h4 className="font-semibold text-emerald-800">Key Findings</h4>
                                <button className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">Expand</button>
                              </div>
                            </div>
                            <div className="p-4">
                              <RichTextRenderer text={msg.text} className="text-emerald-700 leading-relaxed" />
                            </div>
                          </div>

                          {/* Risks and Interactions Callout */}
                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-4">
                            <div className="flex items-start">
                              <svg className="w-5 h-5 text-amber-500 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"></path></svg>
                              <div>
                                <h5 className="font-semibold text-amber-800 mb-1">Safety Considerations</h5>
                                <p className="text-amber-700 text-sm">Always consult with a healthcare professional before using herbal remedies, especially if taking other medications.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {msg.role === 'user' && (
                        <div className="bg-emerald-800 text-white rounded-2xl p-4 shadow-sm max-w-[85%] ml-auto">
                          <div className="text-emerald-200 text-sm mb-1">Your Question</div>
                          <div>{msg.text}</div>
                        </div>
                      )}
                      {msg.isError && (
                        <div className="bg-red-50 text-red-800 border border-red-100 rounded-2xl p-4 max-w-[85%]">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span className="font-semibold">Error</span>
                          </div>
                          {msg.text}
                        </div>
                      )}
                    </div>
                  ))}

                  {isLoading && (
                    <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 flex items-center gap-2 max-w-[85%]">
                      <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce delay-75"></div>
                      <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce delay-150"></div>
                      <span className="text-sm text-emerald-600 ml-2">Analyzing research papers...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Chat Input Area */}
              <div className="p-4 bg-white border-t border-emerald-100">
                <form onSubmit={handleSearch} className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask a follow-up question..."
                    className="w-full pl-4 pr-12 py-3 bg-emerald-50 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-sm"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="absolute right-2 top-2 p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                  </button>
                </form>
              </div>
            </div>

            {/* Sidebar Toggle Button - Shown when sidebar is collapsed */}
            {!isSidebarExpanded && (
              <button
                onClick={() => setIsSidebarExpanded(true)}
                className="fixed left-4 top-1/2 transform -translate-y-1/2 z-30 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg rounded-r-lg p-3 border border-emerald-500 hover:from-emerald-700 hover:to-emerald-800 transition-all duration-300 flex items-center gap-2"
                aria-label="Show Research Evidence"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
                <span className="hidden md:block font-medium">Sources</span>
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;