-- iPhone AR Quick Look reads USDZ, stored next to each real-size GLB
update storage.buckets set allowed_mime_types = array['model/gltf-binary', 'application/octet-stream', 'model/vnd.usdz+zip'] where id = 'glbs';
