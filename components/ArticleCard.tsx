import React, { useState } from 'react';
import { PubMedArticle } from '../types';
import RichTextRenderer from './RichTextRenderer';
import ImageViewer from './ImageViewer';

interface ArticleCardProps {
  article: PubMedArticle;
  index: number;
  showCompact?: boolean;
  onCardClick?: () => void;
}

const ArticleCard: React.FC<ArticleCardProps> = ({
  article,
  index,
  showCompact = false,
  onCardClick
}) => {
  const [expanded, setExpanded] = useState(false);

  // Function to determine evidence strength based on study type
  const getEvidenceStrength = () => {
    if (article.title.toLowerCase().includes('meta-analysis') || article.title.toLowerCase().includes('systematic review')) {
      return { label: 'Strong', color: 'bg-emerald-500', bgColor: 'bg-emerald-100', textColor: 'text-emerald-800' };
    } else if (article.title.toLowerCase().includes('randomized') || article.title.toLowerCase().includes('clinical trial')) {
      return { label: 'High', color: 'bg-teal-500', bgColor: 'bg-teal-100', textColor: 'text-teal-800' };
    } else if (article.title.toLowerCase().includes('observational') || article.title.toLowerCase().includes('cohort')) {
      return { label: 'Moderate', color: 'bg-blue-500', bgColor: 'bg-blue-100', textColor: 'text-blue-800' };
    } else {
      return { label: 'Preliminary', color: 'bg-yellow-500', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' };
    }
  };

  // Function to determine study type
  const getStudyType = () => {
    if (article.title.toLowerCase().includes('meta-analysis')) return 'Meta-analysis';
    if (article.title.toLowerCase().includes('systematic review')) return 'Systematic Review';
    if (article.title.toLowerCase().includes('randomized')) return 'Randomized Trial';
    if (article.title.toLowerCase().includes('clinical trial')) return 'Clinical Trial';
    if (article.title.toLowerCase().includes('observational')) return 'Observational';
    if (article.title.toLowerCase().includes('case')) return 'Case Study';
    if (article.title.toLowerCase().includes('cohort')) return 'Cohort Study';
    if (article.title.toLowerCase().includes('pilot')) return 'Pilot Study';
    return 'Other';
  };

  const evidenceStrength = getEvidenceStrength();
  const studyType = getStudyType();

  // Extract key finding (first sentence of abstract)
  const getKeyFinding = () => {
    const sentences = article.abstract.split(/[.!?]/);
    if (sentences.length > 0) {
      return sentences[0].trim() + '.';
    }
    return article.abstract.substring(0, 100) + '...';
  };

  const keyFinding = getKeyFinding();

  if (showCompact) {
    return (
      <div
        className="bg-gradient-to-r from-white to-emerald-50 border border-emerald-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:border-emerald-400 hover:from-emerald-50 hover:to-emerald-100"
        onClick={onCardClick}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-600">
              #{index + 1}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full ${evidenceStrength.bgColor} ${evidenceStrength.textColor} font-medium`}>
              {evidenceStrength.label}
            </span>
            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full font-medium">
              {studyType}
            </span>
          </div>
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:text-emerald-800 text-xs flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
            PMID: {article.pmid}
          </a>
        </div>

        <h3 className="text-sm font-semibold text-emerald-900 mb-1 leading-tight line-clamp-2">
          {article.title}
        </h3>

        <p className="text-xs text-emerald-700 mb-2 line-clamp-2">
          {keyFinding}
        </p>

        <div className="flex justify-between items-center text-xs text-emerald-600">
          <span className="truncate">{article.journal}</span>
          <span>{article.pubDate}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 text-xs font-bold px-2 py-1 rounded">
            Source #{index + 1}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full ${evidenceStrength.bgColor} ${evidenceStrength.textColor} font-medium`}>
            {evidenceStrength.label} Evidence
          </span>
          <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full font-medium">
            {studyType}
          </span>
        </div>
        <a
          href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-600 hover:text-emerald-800 text-sm flex items-center gap-1"
        >
          PMID: {article.pmid}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
        </a>
      </div>

      <h3 className="text-lg font-semibold text-emerald-900 mb-2 leading-tight">
        {article.title}
      </h3>

      <div className="text-sm text-emerald-700 mb-3 font-medium flex justify-between">
        <span className="truncate">{article.journal}</span>
        <span>{article.pubDate}</span>
      </div>

      {article.imageUrl && (
        <div className="mb-3">
          <ImageViewer
            src={article.imageUrl}
            alt={article.imageAlt || article.title}
            caption={article.imageCaption}
            className="rounded-lg"
          />
        </div>
      )}

      <div className={`text-sm text-emerald-700 ${expanded ? '' : 'line-clamp-3'}`}>
        <RichTextRenderer text={article.abstract} />
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 text-emerald-600 text-sm font-medium hover:text-emerald-800 focus:outline-none"
      >
        {expanded ? 'Show Less' : 'Read Abstract'}
      </button>

      {article.authors.length > 0 && (
        <div className="mt-3 pt-3 border-t border-emerald-100 text-xs text-emerald-600">
          <div className="font-medium">Authors:</div>
          <div className="truncate">{article.authors.join(', ')}</div>
        </div>
      )}
    </div>
  );
};

export default ArticleCard;