import bpy
import math

# initialize rendering setup
# Set the resolution for the render
bpy.context.scene.render.resolution_x = 256
bpy.context.scene.render.resolution_y = 256

# Choose the output format
bpy.context.scene.render.image_settings.file_format = 'PNG'

# Set the output path
output_path = "./SkeletonOutput/"

# Get the camera object
camera = bpy.data.objects["Camera"]

Lateral   = [-1.349, -0.045 , 0.689, 90, 0, -90, "lateral"]
Front     = [-0.2  , -0.7   , 0.7  , 90, 0,   0, "front"  ]

cam = Front

renderData = {}

#initialize camera position
camera.location.x = cam[0]
camera.location.y = cam[1]
camera.location.z = cam[2]

#initialize camera angle
# Set the camera rotation in Euler angles
camera.rotation_euler[0] = math.radians(cam[3]) # X-axis rotation
camera.rotation_euler[1] = math.radians(cam[4]) # Y-axis rotation
camera.rotation_euler[2] = math.radians(cam[5]) # Z-axis rotation


femur_X = 0
femur_Y = 0
femur_Z = 0 

femur_Rot_X = 0.0
femur_Rot_Y = 0
femur_Rot_Z = 0

femur_Length = 0.45

#########  Adjust these, to tweak the x, y, z position of the top of the tibia and fibia before rotating them
#########  The fibia is assumed to be rigidly attached to the tibia
#########  WARNING: the cam movement has not yet been modeled and the knee joint interferes with itself as the tibia rotates

#########  displacements are in meters, the numerical values are the initial coordinates of the bone
tibia_deltaX = 0.0
tibia_deltaY = 0.0
tibia_deltaZ = 0.0

tibia_X = -0.194800 + tibia_deltaX
tibia_Y = -0.045373 + tibia_deltaY
tibia_Z =  0.689436 + tibia_deltaZ

#########  Adjust these, in particular, the first tibia_Rot_X
fileNames = []

######## rotate tibia ########

# Loop for rendering multiple images

delta_tibia_Rot_X_deg = 4
tibia_Rot_X_deg = 0.0  # enter start angle in degrees
tibia_Rot_Y = 0   # enter angle in degrees
tibia_Rot_Z = 0   # enter angle in degrees

rot_x_min = 0
rot_x_max = 4
renderData["rot_x_range"] = [0,rot_x_max]


rot_y_min = 0
rot_y_max = 0
renderData["rot_y_range"] = [rot_y_min,rot_y_max]

for i in range(rot_x_max):
    print ("rendering "+str(i)+" of " + str(rot_x_max))
    
    tibia_Rot_X = (tibia_Rot_X_deg + (i*delta_tibia_Rot_X_deg)) * math.pi / 180.0  #convert to radians
    
    tibia_Rot_Y = tibia_Rot_Y * math.pi / 180.0  #convert to radians

    tibia_Rot_Z = tibia_Rot_Z * math.pi / 180.0  #convert to radians


    ############

    #move femur x
    bpy.data.objects["Femur_R"].location[0] = femur_X

    #move femur y
    bpy.data.objects["Femur_R"].location[1] = femur_Y 

    #move femur z
    bpy.data.objects["Femur_R"].location[2] = femur_Z 

    #rotate x
    bpy.data.objects["Femur_R"].rotation_euler[0] = femur_Rot_X

    #rotate y
    bpy.data.objects["Femur_R"].rotation_euler[1] = femur_Rot_Y

    #rotate z
    bpy.data.objects["Femur_R"].rotation_euler[2] = femur_Rot_Z

    ##############

    #move tibia x
    bpy.data.objects["Tibia_R"].location[0] = tibia_X

    #move tibia y
    bpy.data.objects["Tibia_R"].location[1] = tibia_Y 

    #move tibia z
    bpy.data.objects["Tibia_R"].location[2] = tibia_Z 

    #rotate x
    bpy.data.objects["Tibia_R"].rotation_euler[0] = tibia_Rot_X

    #rotate y
    bpy.data.objects["Tibia_R"].rotation_euler[1] = tibia_Rot_Y

    #rotate z
    bpy.data.objects["Tibia_R"].rotation_euler[2] = tibia_Rot_Z

    ############ Fibia follows tibia

    #move tibia x
    bpy.data.objects["Fibia_R"].location[0] = tibia_X

    #move tibia y
    bpy.data.objects["Fibia_R"].location[1] = tibia_Y 

    #move tibia z
    bpy.data.objects["Fibia_R"].location[2] = tibia_Z 

    #rotate x
    bpy.data.objects["Fibia_R"].rotation_euler[0] = tibia_Rot_X

    #rotate y
    bpy.data.objects["Fibia_R"].rotation_euler[1] = tibia_Rot_Y

    #rotate z
    bpy.data.objects["Fibia_R"].rotation_euler[2] = tibia_Rot_Z


    ############ Rotate the patella around the assumed center point of the knee

    #rotate x
    bpy.data.objects["Patella_R"].rotation_euler[0] = 0.5 * tibia_Rot_X

    #rotate y
    bpy.data.objects["Patella_R"].rotation_euler[1] = 0.5 * tibia_Rot_Y

    #rotate z
    bpy.data.objects["Patella_R"].rotation_euler[2] = 0.5 * tibia_Rot_Z



    ############ Rotate right foot
    bpy.data.objects["Skeletal.060"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.060"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.060"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.061"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.061"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.061"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.062"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.062"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.062"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.063"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.063"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.063"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.064"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.064"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.064"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.065"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.065"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.065"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.066"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.066"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.066"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.067"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.067"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.067"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.068"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.068"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.068"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.069"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.069"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.069"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.070"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.070"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.070"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.071"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.071"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.071"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.072"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.072"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.072"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.073"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.073"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.073"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.074"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.074"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.074"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.075"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.075"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.075"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.077"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.077"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.077"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.156"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.156"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.156"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.157"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.157"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.157"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.158"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.158"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.158"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.159"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.159"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.159"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.160"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.160"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.160"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.176"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.176"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.176"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.177"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.177"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.177"].rotation_euler[2] = tibia_Rot_Z

    bpy.data.objects["Skeletal.178"].rotation_euler[0] = tibia_Rot_X
    bpy.data.objects["Skeletal.178"].rotation_euler[1] = tibia_Rot_Y
    bpy.data.objects["Skeletal.178"].rotation_euler[2] = tibia_Rot_Z
    
    

    # Set the file name for the rendered image
    fn = [int(tibia_Rot_X * 180.0 / math.pi), int(tibia_Rot_Y* 180.0 / math.pi), (int)(tibia_Rot_Z * 180.0 / math.pi)]
    fn = [ f'{fn[0]:04}',  f'{fn[1]:04}',  f'{fn[2]:04}']
    ang = "-".join(fn)
    
    file_name = "_rend_"+ang + ".png"



    # =========================================================
    cam = Front

    #initialize camera position
    camera.location.x = cam[0]
    camera.location.y = cam[1]
    camera.location.z = cam[2]

    #initialize camera angle
    # Set the camera rotation in Euler angles
    camera.rotation_euler[0] = math.radians(cam[3]) # X-axis rotation
    camera.rotation_euler[1] = math.radians(cam[4]) # Y-axis rotation
    camera.rotation_euler[2] = math.radians(cam[5]) # Z-axis rotation

    # Render the scene and write the output to the full path
    # Set the full output path including file name
    full_path = output_path + cam[6] + file_name
    
    fileNames.append(full_path) 
    bpy.ops.render.render(write_still=True, use_viewport=True, scene="Scene")
    bpy.data.images['Render Result'].save_render(full_path)

    # =========================================================
    cam = Lateral

    #initialize camera position
    camera.location.x = cam[0]
    camera.location.y = cam[1]
    camera.location.z = cam[2]

    #initialize camera angle
    # Set the camera rotation in Euler angles
    camera.rotation_euler[0] = math.radians(cam[3]) # X-axis rotation
    camera.rotation_euler[1] = math.radians(cam[4]) # Y-axis rotation
    camera.rotation_euler[2] = math.radians(cam[5]) # Z-axis rotation

    # Render the scene and write the output to the full path
    # Set the full output path including file name
    full_path = output_path + cam[6] + file_name
    
    fileNames.append(full_path)
    
    bpy.ops.render.render(write_still=True, use_viewport=True, scene="Scene")
    bpy.data.images['Render Result'].save_render(full_path)

    # =========================================================
    
    renderData["fileNames"] = fileNames
    namesFile = open(output_path+"rendFileNames.json", "w")
    namesFile.write (json.dumps(renderData))
    namesFile.close()

    """
    # move camera
    #initialize camera position
    camera.location.x += 0.005
    camera.location.y += 0.005
    camera.location.z += 0.005
    
    # rotate camera
    # Set the camera rotation in Euler angles
    camera.rotation_euler[0] += math.radians(.5) # X-axis rotation
    camera.rotation_euler[1] += math.radians(.5) # Y-axis rotation
    camera.rotation_euler[2] += math.radians(.5) # Z-axis rotation
    """
