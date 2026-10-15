// Process Media Types (video, image, audio)
if (['video', 'image', 'audio'].includes(messageType)) {
  const mediaId = message[messageType].id;
  const mimeType = message[messageType].mime_type || '';
  const extension = messageType === 'video' ? 'mp4' : messageType === 'image' ? 'jpg' : 'm4a';

  // 1. Fetch Media URL from Meta Graph API
  const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  const metaData = await metaRes.json();

  if (metaData.url) {
    // 2. Download binary media stream from Meta
    const binaryRes = await fetch(metaData.url, {
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
    });
    const arrayBuffer = await binaryRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Upload to Supabase Storage Bucket
    const filePath = `${fromNumber}/${Date.now()}_${wamid}.${extension}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error(`[Storage Error] Upload failed for ${filePath}:`, uploadError.message);
    } else {
      // Construct exact Supabase storage URL
      mediaUrl = `${SUPABASE_URL}/storage/v1/object/authenticated/${STORAGE_BUCKET}/${filePath}`;
      console.log(`[Media] stored ${filePath}`);
    }
  }
}
