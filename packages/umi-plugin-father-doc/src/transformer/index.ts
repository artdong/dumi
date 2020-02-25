import path from 'path';
import yaml from 'js-yaml';
import slash from 'slash2';
import extractComments from 'esprima-extract-comments';
import remark from './remark';
import html from './html';

const FRONT_COMMENT_EXP = /^\n*\/\*[^]+?\s*\*\/\n*/;

export interface TransformResult {
  content: string;
  html?: string;
  config: {
    [key: string]: any;
  };
}

// From: https://github.com/umijs/umi/blob/master/packages/umi-build-dev/src/routes/getYamlConfig.js
function getYamlConfig(code, componentFile = '') {
  const comments = extractComments(code);

  return comments
    .slice(0, 1)
    .filter(c => c.value.includes(':') && c.loc.start.line === 1)
    .reduce((memo, item) => {
      const { value } = item;
      const v = value.replace(/^(\s+)?\*/gm, '');

      try {
        const yamlResult = yaml.safeLoad(v);
        return {
          ...memo,
          ...yamlResult,
        };
      } catch (e) {
        console.warn(`Annotation fails to parse - ${componentFile}: ${e}`);
      }
      return memo;
    }, {});
}

function wrapperHtmlByComponent(html: string) {
  return `
    import React from 'react';
    import Alert from '${slash(path.join(__dirname, '../themes/default/builtins/Alert.js'))}';
    import FatherDocPreviewer from '${slash(
      path.join(__dirname, '../themes/default/builtins/Previewer.js'),
    )}';

    export default function () {
      return <>${html}</>;
  }`;
}

export default {
  /**
   * transform markdown content to jsx & meta data
   * @param raw         content
   * @param fileAbsDir  absolute path of markdown file
   * @param onlyConfig  whether transform meta data only
   */
  markdown(raw: string, fileAbsDir: string, onlyConfig?: boolean): TransformResult {
    const result = remark(raw, { fileAbsDir, strategy: onlyConfig ? 'data' : 'default' });
    let content = '';

    if (!onlyConfig) {
      // transform html string to jsx string
      content = this.html(result.contents as string);

      // wrap by page component
      content = wrapperHtmlByComponent(content);
    }

    return {
      content,
      html: result.contents as string,
      config: {
        ...(result.data as TransformResult['config']),
      },
    };
  },
  jsx(raw: string): TransformResult {
    return {
      // discard frontmatter for source code display
      content: raw.replace(FRONT_COMMENT_EXP, ''),
      config: getYamlConfig(raw),
    };
  },
  tsx(raw: string): TransformResult {
    return this.jsx(raw);
  },
  /**
   * transform html string to jsx string
   * @param raw   html string
   */
  html(raw: string): TransformResult {
    return html(raw);
  },
};
