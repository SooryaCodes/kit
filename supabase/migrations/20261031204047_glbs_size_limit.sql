-- The whole-shop AR model (every product in one file, real size) runs to about 6 MB for ten products.
-- Raise the 3D models bucket from 5 MB to 15 MB; AR viewers recommend staying under about 10 MB.
update storage.buckets set file_size_limit = 15 * 1024 * 1024 where id = 'glbs';
