import { generateStaticParamsFor, importPage } from 'nextra/pages'

export const generateStaticParams = generateStaticParamsFor('mdxPath')

export default async function DocsPage(props: any) {
  const params = await props.params
  
  // 1. Get the path from the URL (defaults to empty array if at /docs)
  const mdxPath = params?.mdxPath || []
  
  // 2. FORCE Nextra to look inside our new 'content/docs' folder
  const pathToImport = ['docs', ...mdxPath]
  
  // 3. Import the page using the corrected path
  const { default: MDXContent } = await importPage(pathToImport)
  
  return <MDXContent />
}